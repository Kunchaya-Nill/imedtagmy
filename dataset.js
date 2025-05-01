    const serverUrl = "http://localhost:5000";
    let currentProjectId = null;
let currentUserId = null;
    
    // Back button
    document.getElementById("backButton").addEventListener("click", function () {
        window.location.href = "CreateProject.html";
    });


    document.getElementById("menu-upload").addEventListener("click", function () {
    const projectId = getProjectIdFromUrl();
    if (projectId) {
        window.location.href = `Upload.html?id=${projectId}`;
    } else {
        showError("Project ID is missing");
    }
});

document.getElementById("menu-labeling").addEventListener("click", function () {
    const projectId = getProjectIdFromUrl();
    if (projectId) {
        window.location.href = `labeling.html?id=${projectId}`;
    } else {
        showError("Project ID is missing");
    }
});

// Get project ID from URL query parameter
function getProjectIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}
        // Export button functionality
        document.getElementById("exportButton").addEventListener("click", function() {
            document.getElementById("exportModal").style.display = "block";
        });

        // Handle project name editing
        document.getElementById("projectName").addEventListener("click", function() {
            let currentName = this.innerText;
            let input = document.createElement("input");
            input.type = "text";
            input.value = currentName;
            input.classList.add("project-name-input");

            this.replaceWith(input);
            input.focus();

            function saveName() {
                let newName = input.value.trim();
                if (newName === "") newName = "Untitled Project";
                let newDiv = document.createElement("div");
                newDiv.innerText = newName;
                newDiv.classList.add("project-name");
                newDiv.id = "projectName";
                newDiv.addEventListener("click", arguments.callee);
                input.replaceWith(newDiv);
            }

            input.addEventListener("blur", saveName);
            input.addEventListener("keypress", function(event) {
                if (event.key === "Enter") saveName();
            });
        });

        // Image filtering based on search input
        function filterImages() {
            const searchValue = document.getElementById("searchInput").value.toLowerCase();
            document.querySelectorAll(".image-container").forEach(img => {
                img.style.display = img.querySelector("img").alt.toLowerCase().includes(searchValue) ? "block" : "none";
            });
        }

        // Open and load the project data from localStorage
        document.addEventListener("DOMContentLoaded", function() {
            const params = new URLSearchParams(window.location.search);
            const projectName = params.get("name") || "Untitled Project";
            document.getElementById("projectName").innerText = projectName;
            loadProjectData(projectName);
        });

        function loadProjectData(projectName) {
            let projectImages = JSON.parse(localStorage.getItem(`images_${projectName}`)) || [];
            document.getElementById("imagePreview").innerHTML = "";
            projectImages.forEach(displayImage);
        }

        // Display Image in UI
        function displayImage(image) {
            const imagePreview = document.getElementById("imagePreview");
            const imageContainer = document.createElement("div");
            imageContainer.classList.add("image-container");

            const img = document.createElement("img");
            img.src = image.src;

            imageContainer.appendChild(img);
            imagePreview.appendChild(imageContainer);
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
       document.addEventListener("DOMContentLoaded", function() {
    // Automatically highlight the "Dataset" menu item as default
    const labelingMenuItem = document.querySelector('.left-sidebar a:nth-child(3)');
    labelingMenuItem.classList.add('active');
});

document.querySelectorAll(".left-sidebar a").forEach(link => {
    link.addEventListener("click", function() {
        document.querySelectorAll(".left-sidebar a").forEach(item => item.classList.remove("active"));
        this.classList.add("active");
    });
});

        document.getElementById("menu-more").addEventListener("click", function(event) {
            event.preventDefault();
            let menu = document.getElementById("optionsMenu");
            menu.style.display = menu.style.display === "block" ? "none" : "block";
        });
        
        document.addEventListener("click", function(event) {
            let menu = document.getElementById("optionsMenu");
            if (!event.target.closest(".more-options")) {
                menu.style.display = "none";
            }
        });

        function closeExportModal() {
    document.getElementById("exportModal").style.display = "none";
}

async function exportRaw() {
    const projectId = getProjectIdFromUrl();
    try {
        const res = await fetch(`${serverUrl}/api/projects/${projectId}/export/raw`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        if (!res.ok) throw new Error("Export failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `project_${projectId}_raw.zip`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        closeExportModal();
    } catch (error) {
        showError("Failed to export raw images.");
    }
}

async function exportCoco() {
    const projectId = getProjectIdFromUrl();
    try {
      const res = await fetch(`${serverUrl}/api/projects/${projectId}/export/coco`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      });
  
      if (!res.ok) throw new Error("COCO export failed");
  
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `project_${projectId}_coco.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
  
    } catch (err) {
      console.error("COCO export error:", err);
      showError("Failed to export COCO file.");
    }
  }
  