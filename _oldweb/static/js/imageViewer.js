// Image viewer functionality
function openImageGallery(startIndex = 0) {
    const element = event.target.closest('[data-images]');
    const imagesData = element.getAttribute('data-images');

    if (imagesData) {
        currentImageGallery = JSON.parse(imagesData);
    } else {
        // Single image case
        const img = element.querySelector('img');
        currentImageGallery = [{
            url: img.src,
            filename: img.alt
        }];
    }

    currentImageIndex = startIndex;

    const modal = document.getElementById('image-viewer-modal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    updateImageViewer();

    const prevBtn = document.getElementById('viewer-prev');
    const nextBtn = document.getElementById('viewer-next');

    prevBtn.style.display = currentImageGallery.length > 1 ? 'block' : 'none';
    nextBtn.style.display = currentImageGallery.length > 1 ? 'block' : 'none';
}

// Make function globally accessible for onclick handlers
window.openImageGallery = openImageGallery;

function updateImageViewer() {
    const img = document.getElementById('viewer-image');
    const filename = document.getElementById('viewer-filename');
    const counter = document.getElementById('viewer-counter');

    const currentImage = currentImageGallery[currentImageIndex];

    img.src = currentImage.url;
    filename.textContent = currentImage.filename;

    if (currentImageGallery.length > 1) {
        counter.textContent = `${currentImageIndex + 1} / ${currentImageGallery.length}`;
        } else {
        counter.textContent = '';
    }
}

function closeImageViewer() {
    const modal = document.getElementById('image-viewer-modal');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

function navigateImage(direction) {
    if (currentImageGallery.length <= 1) return;

    if (direction === 'prev') {
        currentImageIndex = currentImageIndex > 0 ? currentImageIndex - 1 : currentImageGallery.length - 1;
    } else {
        currentImageIndex = currentImageIndex < currentImageGallery.length - 1 ? currentImageIndex + 1 : 0;
    }

    updateImageViewer();
}