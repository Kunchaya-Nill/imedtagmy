console.log("✅ Upload.js loaded");

const serverUrl = "http://localhost:5000";

document.getElementById("backButton").addEventListener("click", function () {
  window.location.href = "CreateProject.html";
});

document.getElementById("menu-labeling").addEventListener("click", function () {
  const projectId = getProjectIdFromUrl();
  if (projectId) {
      window.location.href = `labeling.html?id=${projectId}`;
  } else {
      showError("Project ID is missing");
  }
});

document.getElementById("menu-dataset").addEventListener("click", function () {
  const projectId = getProjectIdFromUrl();
  if (projectId) {
      window.location.href = `dataset.html?id=${projectId}`;
  } else {
      showError("Project ID is missing");
  }
});

function getProjectIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("id");
}

function showError(message) {
  const errorDiv = document.createElement("div");
  errorDiv.className = "error-message";
  errorDiv.textContent = message;
  Object.assign(errorDiv.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '15px',
    background: '#ff4444',
    color: 'white',
    borderRadius: '5px',
    zIndex: '1000'
  });
  document.body.appendChild(errorDiv);
  setTimeout(() => {
    errorDiv.style.opacity = '0';
    setTimeout(() => errorDiv.remove(), 500);
  }, 3000);
}

function showSuccess(message) {
  const successDiv = document.createElement("div");
  successDiv.className = "success-message";
  successDiv.textContent = message;
  Object.assign(successDiv.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '15px',
    background: '#4CAF50',
    color: 'white',
    borderRadius: '5px',
    zIndex: '1000'
  });
  document.body.appendChild(successDiv);
  setTimeout(() => {
    successDiv.style.opacity = '0';
    setTimeout(() => successDiv.remove(), 500);
  }, 3000);
}

async function handleUploadFormSubmit(event) {
  event.preventDefault();
  console.log("Upload initiated");

  const form = event.target;
  const projectId = getProjectIdFromUrl();
  const token = localStorage.getItem('token');

  if (!projectId) {
    showError('Missing project ID');
    return;
  }

  const files = document.getElementById('imageFiles').files;
  if (files.length === 0) {
    showError('Please select at least one image');
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Uploading...';

  try {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i]);
    }

    console.log("Sending upload request...");
    const response = await fetch(`${serverUrl}/api/images/upload/${projectId}`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include' // Important for cookies if using them
    });

    console.log("Received response:", response.status);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Upload failed with status ${response.status}`);
    }

    const result = await response.json();
    console.log("Upload successful:", result);
    showSuccess(`Uploaded ${result.count} images`);
    form.reset();
    await loadImages(projectId);
  } catch (error) {
    console.error("Upload error:", error);
    showError(error.message || "Upload failed. Check console for details.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

async function loadImages(projectId) {
  try {
    const response = await fetch(`${serverUrl}/api/images/${projectId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
    });
    if (!response.ok) throw new Error("Failed to load images");

    const images = await response.json();
    const preview = document.getElementById("imagePreview");
    preview.innerHTML = "";

    images.forEach(img => {
      const container = document.createElement("div");
      container.className = "image-container";
      container.dataset.id = img.image_id;

      const image = document.createElement("img");
      image.src = `${serverUrl}${img.file_path}`;
      image.alt = img.image_name;

      const btn = document.createElement("button");
      btn.textContent = "X";
      btn.className = "delete-btn";
      btn.onclick = () => deleteImage(img.image_id);

      container.appendChild(image);
      container.appendChild(btn);
      preview.appendChild(container);
    });
  } catch (err) {
    console.error("Error loading images:", err);
    showError("Failed to load images");
  }
}

async function deleteImage(imageId) {
  if (!confirm("Are you sure you want to delete this image?")) return;

  try {
    const response = await fetch(`${serverUrl}/images/${imageId}`, {
      method: "DELETE",
      headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
    });
    if (!response.ok) throw new Error("Delete failed");

    document.querySelector(`.image-container[data-id="${imageId}"]`)?.remove();
    showSuccess("Image deleted successfully");
  } catch (err) {
    console.error("Error deleting image:", err);
    showError("Failed to delete image");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const uploadForm = document.getElementById("uploadForm");
  const projectId = getProjectIdFromUrl();

  if (uploadForm) {
    uploadForm.addEventListener("submit", handleUploadFormSubmit);
  }

  document.getElementById('imageFiles').addEventListener('change', (e) => {
    console.log('Files selected:', e.target.files.length);
  });

  if (projectId) {
    fetch(`${serverUrl}/api/projects/${projectId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
    })
      .then(response => {
        if (!response.ok) throw new Error("Failed to fetch project");
        return response.json();
      })
      .then(project => {
        document.getElementById("projectName").textContent = project.project_name;
        loadImages(projectId);
      })
      .catch(error => {
        console.error("Error loading project:", error);
        showError("Failed to load project details");
      });
  }
});
