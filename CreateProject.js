const serverUrl = "http://localhost:5000";
let selectedType = "";

document.addEventListener("DOMContentLoaded", function () {
    const sidebarLinks = document.querySelectorAll(".sidebar-link");
    const containers = document.querySelectorAll(".container");
    const accountBtn = document.getElementById("accountBtn");
    const accountPopup = document.getElementById("accountPopup");

    // Sidebar click event to switch content
    sidebarLinks.forEach(link => {
        link.addEventListener("click", function (event) {
            event.preventDefault();

            // Remove active class from all sidebar links
            sidebarLinks.forEach(item => item.classList.remove("active"));
            this.classList.add("active");

            // Hide all sections
            containers.forEach(container => container.classList.remove("active"));

            // Show the selected section
            const targetId = this.getAttribute("data-target");
            document.getElementById(targetId).classList.add("active");
        });
    });

    // Toggle account popup
    accountBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        accountPopup.style.display = (accountPopup.style.display === "block") ? "none" : "block";
    });

    document.addEventListener("click", function (event) {
        if (!accountPopup.contains(event.target) && event.target !== accountBtn) {
            accountPopup.style.display = "none";
        }
    });
});

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

document.addEventListener("DOMContentLoaded", () => {
    loadProjects();
    
    // Better event delegation for delete buttons
    document.getElementById("projectContainer").addEventListener("click", function(event) {
        if (event.target.classList.contains("delete-btn")) {
            const projectId = event.target.getAttribute("data-id");
            deleteProject(projectId);
        }
    });
});

// Load projects from the server
async function loadProjects() {
    const token = localStorage.getItem("token");

    if (!token) {
        alert("Not logged in. Redirecting...");
        window.location.href = "login.html";
        return;
    }

    try {
        const response = await fetch("http://localhost:5000/api/projects", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const projects = await response.json();
        const projectContainer = document.getElementById("projectContainer");

        projectContainer.innerHTML = `
            <div class="project-card" onclick="openModal()">
                <h3>+</h3>
                <p>Create New Project</p>
            </div>
        `;

        projects.forEach(project => {
            addProjectToUI(project);
        });
    } catch (error) {
        console.error("Error loading projects:", error);
        alert("Failed to load projects. Please check console for details.");
    }
}

// Add a project to the UI
function addProjectToUI(project) {
    const projectContainer = document.getElementById("projectContainer");
    
    const projectCard = document.createElement("div");
    projectCard.classList.add("project-card");
    projectCard.innerHTML = `
        <div class="project-header">
            <h3>${project.project_name}</h3>
        </div>
        <p>Type: ${project.tag || 'Not specified'}</p>
        <p>Status: ${project.labeled_status ? 'Labeled' : 'Not labeled'}</p>
        <div class="button-container">
            <button class="open-btn" onclick="window.location.href='Upload.html?id=${project.project_id}'">Open</button>
            <button class="delete-btn" data-id="${project.project_id}">Delete</button>
        </div>
    `;

    projectContainer.appendChild(projectCard);
}

// Create a new project
async function createProject() {
    const projectName = document.getElementById("projectName").value.trim();
    const tags = Array.from(document.querySelectorAll(".tag span:first-child"))
                     .map(tag => tag.innerText.replace("#", ""))
                     .filter(tag => tag.trim() !== "");

    if (!projectName || !selectedType) {
        alert("Please enter a project name and select a type.");
        return;
    }

    const token = localStorage.getItem("token");
    const decoded = jwt_decode(token);
    const userId = decoded.userId;


    const newProject = {
        user_id: userId,
        project_name: projectName,
        tag: selectedType,
        labeled_status: 0 // Default to not labeled
    };

    try {
        const response = await fetch("http://localhost:5000/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newProject)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to create project");
        }

        const createdProject = await response.json();
        addProjectToUI(createdProject);
        closeModal();
        
        // Clear the form
        document.getElementById("projectName").value = "";
        document.getElementById("tagContainer").innerHTML = "";
        document.querySelectorAll(".option").forEach(opt => opt.classList.remove("selected"));
        selectedType = "";
        
    } catch (error) {
        console.error("Error creating project:", error);
        alert(`Failed to create project: ${error.message}`);
    }
}

// Delete a project
async function deleteProject(projectId) {
    if (!confirm("Are you sure you want to delete this project?")) {
        return;
    }

    const token = localStorage.getItem("token");

    try {
        const response = await fetch(`http://localhost:5000/projects/${projectId}`, {
            method: "DELETE",
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Failed to delete project");
        }

        loadProjects(); // reload UI
        alert("Project deleted successfully!");
    } catch (error) {
        console.error("Error deleting project:", error);
        alert(`Failed to delete project: ${error.message}`);
    }
}


// Modal functions
function openModal() {
    document.getElementById("projectModal").style.display = "flex";
}

function closeModal() {
    document.getElementById("projectModal").style.display = "none";
}

// Tag functionality
function addTag(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        const input = document.getElementById("searchTag");
        const tagText = input.value.trim();
        
        if (tagText) {
            const tagContainer = document.getElementById("tagContainer");
            const tag = document.createElement("div");
            tag.classList.add("tag");

            tag.innerHTML = `
                <span>#${tagText}</span>
                <span class="close-icon" onclick="this.parentElement.remove()">×</span>
            `;

            tagContainer.appendChild(tag);
            input.value = "";
        }
    }
}

// Filter projects
function filterProjects() {
    const query = document.getElementById("searchBox").value.toLowerCase();
    document.querySelectorAll(".project-card").forEach(card => {
        const projectName = card.querySelector("h3")?.innerText.toLowerCase() || "";
        card.style.display = projectName.includes(query) ? "block" : "none";
    });
}

// Select project type
function selectOption(element, type) {
    document.querySelectorAll(".option").forEach(option => 
        option.classList.remove("selected")
    );
    element.classList.add("selected");
    selectedType = type;
    
    // Update example image based on selection
    const imageElement = document.getElementById("exampleImage");
    if (type === "Object Detection") {
        imageElement.src = "https://via.placeholder.com/400x200.png?text=Object+Detection+Example";
        imageElement.style.display = "block";
    } else if (type === "Instance Segmentation") {
        imageElement.src = "https://via.placeholder.com/400x200.png?text=Instance+Segmentation+Example";
        imageElement.style.display = "block";
    } else {
        imageElement.style.display = "none";
    }
}