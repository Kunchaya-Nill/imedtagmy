const serverUrl = "http://localhost:5000";
let currentProjectId = null;
let currentUserId = null;

const elements = {
  projectName: document.getElementById("projectName"),
  backButton: document.getElementById("backButton"),
  startLabelingBtn: document.getElementById("startLabelingBtn"),
  sentToDataset: document.getElementById("sentToDataset"),
  searchInput: document.getElementById("searchInput"),
  allLabeling: document.getElementById("allLabeling"),
  notLabeling: document.getElementById("notLabeling"),
  alreadyLabeling: document.getElementById("alreadyLabeling"),
  imageUpload: document.getElementById("imageUpload"),
  imagePreview: document.getElementById("imagePreview"),
  errorMessage: document.getElementById("errorMessage"),
  progressBar: document.getElementById("progressBar"),
  imageCount: document.getElementById("imageCount"),
  labelCount: document.getElementById("labelCount"),
  nonLabelCount: document.getElementById("nonLabelCount"),
  instructionBox: document.getElementById("instructionBox"),
  creatorName: document.getElementById("creatorName"),
  deleteProject: document.getElementById("deleteProject"),
  logout: document.getElementById("logout"),
  menuMore: document.getElementById("menu-more"),
  optionsMenu: document.getElementById("optionsMenu"),
};

function getProjectIdFromUrl() {
  return new URLSearchParams(window.location.search).get("id");
}

function jwt_decode(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    localStorage.removeItem("token");
    window.location.href = "login.html";
    return {};
  }
}

function showError(msg) {
  elements.errorMessage.textContent = msg;
  elements.errorMessage.style.display = msg ? "block" : "none";
}

function setActiveButton(button) {
  document.querySelectorAll(".label-buttons button").forEach((btn) => btn.classList.remove("active"));
  button.classList.add("active");
}

function updateProgressBar() {
  const containers = document.querySelectorAll(".image-container");
  const labeledCount = [...containers].filter(c => c.dataset.labeled === "true").length;
  const totalCount = containers.length;
  const progress = totalCount > 0 ? Math.round((labeledCount / totalCount) * 100) : 0;

  elements.imageCount.textContent = `${totalCount} Images`;
  elements.labelCount.textContent = `${labeledCount} Labeled`;
  elements.nonLabelCount.textContent = `${totalCount - labeledCount} Non-Labeled`;
  elements.progressBar.style.width = `${progress}%`;
  elements.sentToDataset.style.display = labeledCount > 0 ? "inline-block" : "none";
}

function filterImages() {
  const search = elements.searchInput.value.toLowerCase();
  const active = document.querySelector(".label-buttons button.active").id;

  document.querySelectorAll(".image-container").forEach(container => {
    const alt = container.querySelector("img").alt.toLowerCase();
    const isLabeled = container.dataset.labeled === "true";

    const matchesSearch = alt.includes(search);
    const matchesFilter = active === "allLabeling" ||
      (active === "notLabeling" && !isLabeled) ||
      (active === "alreadyLabeling" && isLabeled);

    container.style.display = matchesSearch && matchesFilter ? "block" : "none";
  });
}

async function loadProjectData(projectId) {
  try {
    const response = await fetch(`${serverUrl}/api/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const project = await response.json();
    elements.projectName.textContent = project.project_name;

    const userRes = await fetch(`${serverUrl}/api/user/${project.user_id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const user = await userRes.json();
    elements.creatorName.textContent = user.name || "Unknown";
  } catch (err) {
    showError("Failed to load project info");
  }
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
    const res = await fetch(`${serverUrl}/api/images/${projectId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const images = await res.json();
    const container = elements.imagePreview;
    container.innerHTML = "";

    images.forEach((img) => {
      const div = document.createElement("div");
      div.className = "image-container";
      div.dataset.id = img.image_id;
      div.dataset.labeled = img.labeled_status ? "true" : "false";

      const image = document.createElement("img");
      image.src = `${serverUrl}${img.file_path}`;
      image.alt = img.image_name;

      div.appendChild(image);
      container.appendChild(div);
    });
    updateProgressBar();
  } catch (err) {
    showError("Failed to load images");
  }
}

async function deleteProject(projectId) {
  try {
    const res = await fetch(`${serverUrl}/api/projects/${projectId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (res.ok) {
      window.location.href = "CreateProjects.html";
    } else {
      throw new Error("Failed to delete");
    }
  } catch (err) {
    showError("Could not delete project");
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token) return (window.location.href = "login.html");
  currentUserId = jwt_decode(token).userId;
  currentProjectId = getProjectIdFromUrl();

  await loadProjectData(currentProjectId);
  await loadImages(currentProjectId);

  elements.backButton.addEventListener("click", () => {
    window.location.href = "CreateProject.html";
  });

  elements.searchInput.addEventListener("keyup", filterImages);
  elements.allLabeling.addEventListener("click", () => {
    setActiveButton(elements.allLabeling);
    filterImages();
  });
  elements.notLabeling.addEventListener("click", () => {
    setActiveButton(elements.notLabeling);
    filterImages();
  });
  elements.alreadyLabeling.addEventListener("click", () => {
    setActiveButton(elements.alreadyLabeling);
    filterImages();
  });
  elements.menuMore.addEventListener("click", (e) => {
    e.preventDefault();
    elements.optionsMenu.style.display =
      elements.optionsMenu.style.display === "block" ? "none" : "block";
  });
  elements.deleteProject.addEventListener("click", (e) => {
    e.preventDefault();
    if (confirm("Are you sure you want to delete this project?")) {
      deleteProject(currentProjectId);
    }
  });
  elements.logout.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "login.html";
  });

  elements.startLabelingBtn.addEventListener("click", () => {
    if (currentProjectId) {
      window.location.href = `detection.html?id=${currentProjectId}`;
    } else {
      showError("Project ID is missing");
    }
  });
});