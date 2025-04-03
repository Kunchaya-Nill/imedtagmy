        let selectedType = "";
        let projects = JSON.parse(localStorage.getItem("projects")) || [];

        document.addEventListener("DOMContentLoaded", () => {
            loadProjects();
        });

// ✅ Select project type
function selectOption(element, type) {
    document.querySelectorAll(".option").forEach(option => option.classList.remove("selected"));
    element.classList.add("selected");
    selectedType = type;

    // Get the image element
    let imageElement = document.getElementById("exampleImage");

    // Set the image based on type
    let imagePath = "";
    if (type === "Object Detection") {
        imagePath = "https://via.placeholder.com/400x200.png?text=Object+Detection+Example"; // Replace with a direct image URL
    } else if (type === "Instance Segmentation") {
        imagePath = "https://via.placeholder.com/400x200.png?text=Instance+Segmentation+Example"; // Replace with a direct image URL
    }

    if (imagePath) {
        imageElement.src = imagePath;
        imageElement.style.display = "block"; // Show image
    } else {
        imageElement.style.display = "none"; // Hide if no valid selection
    }
}

// Load projects from the server
async function loadProjects() {
    try {
        const response = await fetch("/api/projects");
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        let projects = await response.json();
        if (!Array.isArray(projects)) throw new Error("Expected an array of projects");

        const projectContainer = document.getElementById("projectContainer");
        projectContainer.innerHTML = `<div class="project-card" onclick="openModal()"><h3>+</h3><p>Create New Project</p></div>`;

        // Assign new sequential IDs
        projects.forEach((project, index) => {
            addProjectToUI(project, index + 1);
        });
    } catch (error) {
        console.error("Error loading projects:", error);
        alert("Failed to load projects. Check the console for more details.");
    }
}


// Create a new project
async function createProject() {
    let projectName = document.getElementById("projectName").value.trim();
    let tags = Array.from(document.querySelectorAll(".tag span:first-child")).map(tag => tag.innerText.replace("#", ""));
    
    let userId = localStorage.getItem("user_id"); // Retrieve user_id (ensure it's stored)

    if (!projectName || !userId) {
        alert("Please enter a project name and ensure you are logged in.");
        return;
    }

    const newProject = {
        user_id: userId,           // ✅ Send user_id
        project_name: projectName, // ✅ Correct key
        tag: tags.join(","),       // ✅ Convert array to comma-separated string
        labeled_status: 0,         // ✅ Default value
    };

    console.log("Sending payload:", newProject); // Debugging

    try {
        const response = await fetch("http://localhost:5000/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newProject),
        });

        const data = await response.json(); // Parse response

        if (!response.ok) {
            throw new Error(data.error || "Failed to create project.");
        }

        console.log("Server response:", data); // Debugging server response
        addProjectToUI(data);
        loadProjects();
        closeModal();
    } catch (error) {
        console.error("Error creating project:", error);
        alert(`Failed to create project: ${error.message}`);
    }
}


// Add a project to the UI
// Function to add a project to the UI
function addProjectToUI(project) {
    const projectContainer = document.getElementById("projectContainer");

    const projectCard = document.createElement("div");
    projectCard.classList.add("project-card");
    projectCard.innerHTML = `
        <h3>${project.name}</h3>
        <p>${project.type}</p>
        <div class="button-container">
            <button class="open-btn" onclick="window.location.href='Upload.html?id=${project.id}'">Open</button>
            <button class="delete-btn" data-id="${project.id}">Delete</button>
        </div>
    `;

    projectContainer.appendChild(projectCard);
}

// Function to delete a project
async function deleteProject(projectId) {
    if (!confirm("Are you sure you want to delete this project?")) {
        return;
    }

    try {
        const response = await fetch(`http://localhost:5000/projects/${projectId}`, {
            method: "DELETE",
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to delete project.");
        }

        // Reload projects after deletion
        loadProjects();
        alert("Project deleted successfully!");
    } catch (error) {
        console.error("Error deleting project:", error);
        alert(`Failed to delete project: ${error.message}`);
    }
}

// Attach event listeners to delete buttons
document.getElementById("projectContainer").addEventListener("click", (event) => {
    if (event.target.classList.contains("delete-btn")) {
        const projectId = event.target.getAttribute("data-id");
        deleteProject(projectId);
    }
});


// Load projects when the page loads
window.onload = loadProjects;

// Open the modal
function openModal() {
    document.getElementById("projectModal").style.display = "flex";
}

// Close the modal
function closeModal() {
    document.getElementById("projectModal").style.display = "none";
}

// Attach event listeners to delete buttons
document.querySelectorAll(".delete-btn").forEach((btn) => {
  btn.addEventListener("click", (event) => {
    const projectId = event.target.dataset.id; // Get project ID from button
    deleteProject(projectId);
  });
});


// Attach event listeners to delete buttons
document.querySelectorAll(".delete-btn").forEach((btn) => {
  btn.addEventListener("click", (event) => {
    const projectId = event.target.dataset.id; // Get project ID from button
    deleteProject(projectId);
  });
});


// Add event listener to delete buttons
document.querySelectorAll(".delete-btn").forEach((btn) => {
  btn.addEventListener("click", (event) => {
    const projectId = event.target.dataset.id; // Assume your delete button has data-id="project_id"
    deleteProject(projectId);
  });
});


// Add a tag
function addTag(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        let input = document.getElementById("searchTag");
        let tagText = input.value.trim();
        if (tagText) {
            let tagContainer = document.getElementById("tagContainer");

            let tag = document.createElement("div");
            tag.classList.add("tag");

            let tagLabel = document.createElement("span");
            tagLabel.innerText = "#" + tagText;

            let closeIcon = document.createElement("span");
            closeIcon.classList.add("close-icon");
            closeIcon.innerText = "×";
            closeIcon.onclick = function () { tag.remove(); };

            tag.appendChild(tagLabel);
            tag.appendChild(closeIcon);
            tagContainer.appendChild(tag);

            input.value = "";
        }
    }
}

// Filter projects based on search input
function filterProjects() {
    let search = document.getElementById("searchBox").value.toLowerCase();
    let projectContainer = document.getElementById("projectContainer");
    projectContainer.innerHTML = `<div class="project-card" onclick="openModal()"><h3>+</h3><p>Create New Project</p></div>`;

    fetch("/api/projects")
        .then(response => response.json())
        .then(projects => {
            projects.forEach(project => {
                if (project.name.toLowerCase().includes(search) || project.tags.some(tag => tag.toLowerCase().includes(search))) {
                    addProjectToUI(project);
                }
            });
        });
}

// Load projects when the page loads
window.onload = loadProjects;

// Sidebar functionality
document.querySelectorAll(".sidebar-link").forEach(link => {
    link.addEventListener("click", function (e) {
        e.preventDefault();
        const menu = this.getAttribute("data-menu");
        alert(`Navigating to ${menu}`); // Replace with actual navigation logic
    });
});

    // ✅ Select project type
    function selectOption(element, type) {
        document.querySelectorAll(".option").forEach(option => option.classList.remove("selected"));
        element.classList.add("selected");
        selectedType = type;
    }

    // ✅ Add tag functionality
    function addTag(event) {
        if (event.key === "Enter") {
                event.preventDefault();
                let input = document.getElementById("searchTag");
                let tagText = input.value.trim();
                if (tagText) {
                    let tagContainer = document.getElementById("tagContainer");

                    let tag = document.createElement("div");
                    tag.classList.add("tag");

                    let tagLabel = document.createElement("span");
                    tagLabel.innerText = "#" + tagText;

                    let closeIcon = document.createElement("span");
                    closeIcon.classList.add("close-icon");
                    closeIcon.innerText = "×";
                    closeIcon.onclick = function () { tag.remove(); };

                    tag.appendChild(tagLabel);
                    tag.appendChild(closeIcon);
                    tagContainer.appendChild(tag);

                    input.value = "";
                }
            }
    }


        function saveProject(name, type) {
            let projects = JSON.parse(localStorage.getItem("projects")) || [];
            projects.push({ name, type });
            localStorage.setItem("projects", JSON.stringify(projects));
        }
        
        window.onload = () => projects.forEach(addProjectToUI);