document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('pieces');
  const camera = document.querySelector('a-camera');
  const center = document.getElementById('center');
  const centerText = document.getElementById('centerText');
  const centerPos = {x:0, y:0.5, z:0};

  let selectedPiece = null;
  let offset = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const zFixed = 0;

  const pieces = [];
  const models = [
    './models/piece1.glb',
    './models/piece2.glb',
    './models/piece3.glb',
    './models/piece4.glb',
    './models/piece5.glb',
    './models/piece6.glb'
  ];

  const raggio = 1.5;
  const pezzoScale = 0.25;
  const raggioSnap = 1;

  // Creazione pezzi in cerchio
  for (let i = 0; i < models.length; i++) {
    const angle = (i / models.length) * Math.PI * 2;
    const x = Math.cos(angle) * raggio;
    const y = Math.sin(angle) * raggio + 0.5;

    const piece = document.createElement('a-entity');
    piece.setAttribute('gltf-model', models[i]);
    piece.setAttribute('position', {x, y, z: zFixed});
    piece.setAttribute('scale', {x:pezzoScale, y:pezzoScale, z:pezzoScale});
    piece.dataset.locked = "false";
    piece.setAttribute('data-raycastable', 'true');

    piece.addEventListener('model-loaded', () => console.log('Caricato', models[i]));

    container.appendChild(piece);
    pieces.push(piece);
  }

  function updateMouse(event){
    if(event.touches){
      mouse.x = (event.touches[0].clientX / window.innerWidth)*2-1;
      mouse.y = -(event.touches[0].clientY / window.innerHeight)*2+1;
    } else{
      mouse.x = (event.clientX / window.innerWidth)*2-1;
      mouse.y = -(event.clientY / window.innerHeight)*2+1;
    }
  }

  function onPointerDown(event){
    updateMouse(event);
    raycaster.setFromCamera(mouse, camera.object3D);
    const intersects = raycaster.intersectObjects(
      pieces.filter(p => p.dataset.locked === "false").map(p => p.object3D), true
    );
    if(intersects.length>0){
      selectedPiece = intersects[0].object.el;
      const intersectionPoint = new THREE.Vector3();
      raycaster.ray.at((zFixed - raycaster.ray.origin.z)/raycaster.ray.direction.z, intersectionPoint);
      offset.copy(selectedPiece.object3D.position).sub(intersectionPoint);
    }
  }

  function onPointerMove(event){
    if(!selectedPiece) return;
    updateMouse(event);
    raycaster.setFromCamera(mouse, camera.object3D);
    const intersectionPoint = new THREE.Vector3();
    raycaster.ray.at((zFixed - raycaster.ray.origin.z)/raycaster.ray.direction.z, intersectionPoint);

    const newPos = {
      x: intersectionPoint.x + offset.x,
      y: intersectionPoint.y + offset.y,
      z: zFixed
    };

    selectedPiece.setAttribute('position', newPos);

    const distanzaCentro = Math.sqrt((newPos.x - centerPos.x)**2 + (newPos.y - centerPos.y)**2);
    const scale = (distanzaCentro < raggioSnap) ? pezzoScale*1.2 : pezzoScale;
    selectedPiece.setAttribute('scale', {x:scale, y:scale, z:scale});
  }

  function onPointerUp(){
    if(!selectedPiece) return;

    const pos = selectedPiece.getAttribute('position');
    const distanzaCentro = Math.sqrt((pos.x - centerPos.x)**2 + (pos.y - centerPos.y)**2);

    if(distanzaCentro < raggioSnap){
      selectedPiece.setAttribute('animation__move', {
        property: 'position',
        to: `${centerPos.x} ${centerPos.y} ${centerPos.z}`,
        dur: 500,
        easing: 'easeOutQuad'
      });
      selectedPiece.setAttribute('animation__scale', {
        property: 'scale',
        to: '0.5 0.5 0.5',
        dur: 500,
        easing: 'easeOutQuad'
      });
      selectedPiece.dataset.locked = "true";
      centerText.setAttribute('visible','false');
    } else {
      selectedPiece.setAttribute('scale', {x:pezzoScale, y:pezzoScale, z:pezzoScale});
    }

    selectedPiece = null;

    setTimeout(() => {
      if(pieces.every(p=>p.dataset.locked==="true")){
        pieces.forEach(p => { if(p.parentNode) p.parentNode.removeChild(p); });
        const finalShape = document.createElement('a-entity');
        finalShape.setAttribute('gltf-model','./models/piece_final.glb');
        finalShape.setAttribute('position',{...centerPos});
        finalShape.setAttribute('scale',{x:0.5, y:0.5, z:0.5});
        center.appendChild(finalShape);
        finalShape.setAttribute('animation__float', {
          property:'position',
          dir:'alternate',
          dur:1000,
          easing:'easeInOutSine',
          loop:true,
          to:`${centerPos.x} ${centerPos.y + 0.3} ${centerPos.z}`
        });
      }
    },600);
  }

  // Eventi
  window.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);
  window.addEventListener('touchstart', onPointerDown, {passive:false});
  window.addEventListener('touchmove', onPointerMove, {passive:false});
  window.addEventListener('touchend', onPointerUp);
});
