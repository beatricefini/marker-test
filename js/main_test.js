// js/main_test.js
document.addEventListener('DOMContentLoaded', () => {
  // elementi A-Frame
  const container = document.getElementById('pieces');           // dentro <a-entity mindar-image-target>
  const cameraEl = document.querySelector('a-camera');           // <a-camera> gestita da MindAR
  const center = document.getElementById('center');
  const centerText = document.getElementById('centerText');
  const targetEl = container ? container.closest('[mindar-image-target]') : null;

  if (!container || !cameraEl || !targetEl) {
    console.warn('Assicurati che in HTML esistano #pieces, <a-camera> e che #pieces sia dentro <a-entity mindar-image-target>.');
    return;
  }

  // centro relativo al target (coordinate locali)
  const centerPos = new THREE.Vector3(0, 0, 0);

  // stato interazione
  let selectedPiece = null;
  const offset = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // parametri (regolali se il target è molto piccolo/grande)
  const models = [
    'models/piece1.glb',
    'models/piece2.glb',
    'models/piece3.glb',
    'models/piece4.glb',
    'models/piece5.glb',
    'models/piece6.glb'
  ];
  const raggio = 0.6;        // distanza iniziale dal centro (in coordinate locali del target)
  const pezzoScale = 0.2;    // scala iniziale pezzi
  const raggioSnap = 0.35;   // distanza di snap al centro

  // Creo i pezzi intorno al centro (coordinate locali del target)
  const pieces = [];
  for (let i = 0; i < models.length; i++) {
    const angle = (i / models.length) * Math.PI * 2;
    const x = Math.cos(angle) * raggio;
    const y = Math.sin(angle) * raggio;

    const piece = document.createElement('a-entity');
    piece.setAttribute('gltf-model', models[i]);
    piece.setAttribute('position', `${x} ${y} 0`);
    piece.setAttribute('scale', `${pezzoScale} ${pezzoScale} ${pezzoScale}`);
    piece.dataset.locked = "false";

    piece.addEventListener('model-loaded', () => console.log('Caricato', models[i]));

    container.appendChild(piece);
    pieces.push(piece);
  }

  // aggiorna mouse / touch in normalized device coords
  function updateMouse(event) {
    if (event.touches && event.touches.length > 0) {
      mouse.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
    } else {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }
  }

  // restituisce il punto di intersezione (world) del ray con un piano costruito attraverso il centro del target
  function getIntersectionWorld() {
    const camObj = cameraEl.getObject3D('camera');
    if (!camObj) return null;

    raycaster.setFromCamera(mouse, camObj);

    // punto e normale del piano: piano passante per il centro del target, normale = direzione della camera (così il piano è "parallelo allo schermo")
    const targetWorldPos = new THREE.Vector3();
    targetEl.object3D.getWorldPosition(targetWorldPos);

    const camDir = new THREE.Vector3();
    camObj.getWorldDirection(camDir).normalize();

    const plane = new THREE.Plane();
    plane.setFromNormalAndCoplanarPoint(camDir, targetWorldPos);

    const intersectWorld = new THREE.Vector3();
    const ok = raycaster.ray.intersectPlane(plane, intersectWorld);
    if (!ok) return null;
    return intersectWorld;
  }

  function onPointerDown(event) {
    updateMouse(event);
    // trova intersect col mesh (raycaster già impostato nella getIntersectionWorld)
    const camObj = cameraEl.getObject3D('camera');
    if (!camObj) return;

    raycaster.setFromCamera(mouse, camObj);
    const intersectObjects = pieces
      .filter(p => p.dataset.locked === "false")
      .map(p => p.object3D);
    const intersects = raycaster.intersectObjects(intersectObjects, true);
    if (intersects.length > 0) {
      selectedPiece = intersects[0].object.el;

      const intersectionWorld = getIntersectionWorld();
      if (!intersectionWorld) return;

      // trasformo il punto world in coordinate locali del genitore del pezzo
      const intersectionLocal = intersectionWorld.clone();
      selectedPiece.object3D.parent.worldToLocal(intersectionLocal);

      // offset tra posizione pezzo e punto di intersezione locale
      const piecePosLocal = selectedPiece.object3D.position.clone();
      offset.copy(piecePosLocal).sub(intersectionLocal);

      // prevenzione scroll su touch
      if (event.touches) event.preventDefault();
    }
  }

  function onPointerMove(event) {
    if (!selectedPiece) return;
    updateMouse(event);

    const intersectionWorld = getIntersectionWorld();
    if (!intersectionWorld) return;

    const intersectionLocal = intersectionWorld.clone();
    selectedPiece.object3D.parent.worldToLocal(intersectionLocal);

    const newPosLocal = intersectionLocal.clone().add(offset);

    selectedPiece.setAttribute('position', `${newPosLocal.x} ${newPosLocal.y} ${newPosLocal.z}`);

    // evidenzia zona snap
    const distanzaCentro = newPosLocal.distanceTo(centerPos);
    if (distanzaCentro < raggioSnap) {
      selectedPiece.setAttribute('scale', `${pezzoScale * 1.2} ${pezzoScale * 1.2} ${pezzoScale * 1.2}`);
    } else {
      selectedPiece.setAttribute('scale', `${pezzoScale} ${pezzoScale} ${pezzoScale}`);
    }
  }

  function checkAllAtCenter() {
    return pieces.every(p => p.dataset.locked === "true");
  }

  function onPointerUp() {
    if (!selectedPiece) return;

    // posizione locale del pezzo (THREE.Vector3)
    const posLocal = selectedPiece.object3D.position.clone();
    const distanzaCentro = posLocal.distanceTo(centerPos);

    if (distanzaCentro < raggioSnap) {
      // Snap al centro (animazione A-Frame)
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
      centerText.setAttribute('visible', 'false');
    } else {
      // ritorna a scala normale
      selectedPiece.setAttribute('scale', `${pezzoScale} ${pezzoScale} ${pezzoScale}`);
    }

    selectedPiece = null;

    // dopo pausa verifica se tutti sono al centro e mostra finale
    setTimeout(() => {
      if (checkAllAtCenter()) {
        // rimuovi i pezzi originali
        pieces.forEach(p => { if (p.parentNode) p.parentNode.removeChild(p); });

        // mostra il GLB finale al centro
        const finalShape = document.createElement('a-entity');
        finalShape.setAttribute('gltf-model', 'models/piece_final.glb');
        finalShape.setAttribute('position', `${centerPos.x} ${centerPos.y} ${centerPos.z}`);
        finalShape.setAttribute('scale', `0.5 0.5 0.5`);
        center.appendChild(finalShape);

        // animazione di fluttuazione
        finalShape.setAttribute('animation__float', {
          property: 'position',
          dir: 'alternate',
          dur: 1000,
          easing: 'easeInOutSine',
          loop: true,
          to: `${centerPos.x} ${centerPos.y + 0.3} ${centerPos.z}`
        });
      }
    }, 600);
  }

  // eventi input
  window.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);

  window.addEventListener('touchstart', onPointerDown, { passive: false });
  window.addEventListener('touchmove', onPointerMove, { passive: false });
  window.addEventListener('touchend', onPointerUp);
});
