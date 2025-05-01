// Database connection settings
const serverUrl = "http://localhost:5000";
let currentProjectId = null;
let currentImageId = null;
let labels = [];
let currentLabelId = null;
let isDrawing = false;
let startX, startY;
let rectangles = [];
let selectedLabelId = null;
let currentImageElement = null;

// DOM Elements
const canvas = document.getElementById('imageCanvas');
const ctx = canvas.getContext('2d');
const imageList = document.getElementById('imageList');
const labelList = document.getElementById('labelList');
const drawnLabels = document.getElementById('drawnLabels');
const backButton = document.getElementById('backButton');

// Back button functionality
backButton.addEventListener('click', () => {
    window.location.href = `Labeling.html?id=${currentProjectId}`;
});

// Helper to show error messages
function showErrorToUser(message) {
    const errorElement = document.getElementById('errorDisplay') || createErrorElement();
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

function createErrorElement() {
    const errorElement = document.createElement('div');
    errorElement.id = 'errorDisplay';
    errorElement.style = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px;
      background: #ff4444;
      color: white;
      border-radius: 5px;
      z-index: 1000;
      display: none;
    `;
    document.body.appendChild(errorElement);
    return errorElement;
}

// Load project info
async function loadProject(projectId) {
    try {
        const response = await fetch(`${serverUrl}/api/projects/${projectId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to load project');
        const project = await response.json();
        document.title = `Labeling - ${project.project_name}`;
    } catch (error) {
        console.error('Error loading project:', error);
        throw error;
    }
}

// Fetch and render images
async function loadImages(projectId) {
    try {
        const response = await fetch(`${serverUrl}/api/images/${projectId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('Failed to load images');
        const images = await response.json();
        renderImageList(images);
    } catch (error) {
        console.error('Error loading images:', error);
        throw error;
    }
}

// Render image thumbnails
function renderImageList(images) {
    imageList.innerHTML = '';
    images.forEach(image => {
        const imgElement = document.createElement('img');
        let imageUrl = image.file_path.startsWith('/uploads/') ? image.file_path : `/uploads/${image.file_path}`;
        const fullUrl = serverUrl + imageUrl;
        imgElement.src = fullUrl;
        imgElement.className = 'image-thumbnail';
        imgElement.dataset.id = image.image_id;
        imgElement.addEventListener('click', () => {
            currentImageId = image.image_id;
            loadImageToCanvas(fullUrl);
            loadAnnotations(image.image_id);
        });
        imageList.appendChild(imgElement);
    });
}

// Load image onto canvas
function loadImageToCanvas(fullImageUrl) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        currentImageElement = img; // 💾 Save loaded image

        redrawCanvas(); // Always use redrawCanvas now
        drawRectangles();
        setupCanvasEvents();
    };
    img.onerror = (e) => {
        console.error('Failed to load image:', e);
        showErrorToUser('Failed to load image.');
    };
    img.src = fullImageUrl;
}

// Load labels for project
async function loadLabels(projectId) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = 'login.html';
      return;
    }

    const response = await fetch(`${serverUrl}/api/projects/${projectId}/labels`, {
      headers: {
          'Authorization': `Bearer ${token}`
      }
  });
                if (!response.ok) throw new Error('Failed to load labels');
                
                labels = await response.json();
                renderLabelList();
            } catch (error) {
                console.error('Error loading labels:', error);
                throw error;
            }
        }

                // Initialize when page loads
                document.addEventListener('DOMContentLoaded', async () => {
                    // Check if user is logged in
                    const token = localStorage.getItem('token');
                    if (!token) {
                      window.location.href = 'login.html';
                      return;
                    }
                  
                    // Get project ID from URL
                    const urlParams = new URLSearchParams(window.location.search);
                    currentProjectId = urlParams.get('id');
                    
                    if (!currentProjectId) {
                      alert('No project ID specified');
                      window.location.href = 'projects.html';
                      return;
                    }
                  
                    try {
                      // Load project data with auth header
                      await loadProject(currentProjectId);
                      
                      // Load images for this project with auth header
                      await loadImages(currentProjectId);
                      
                      // Load labels for this project with auth header
                      await loadLabels(currentProjectId);
                      
                      // Setup canvas event listeners
                      setupCanvasEvents();
                    } catch (error) {
                      console.error('Initialization error:', error);
                      if (error.message.includes('401')) {
                        window.location.href = 'login.html';
                      } else {
                        alert('Failed to initialize application');
                      }
                    }
                  });
        
        // Render label list
        function renderLabelList() {
            labelList.innerHTML = '';
            labels.forEach(label => {
                const labelElement = document.createElement('div');
                labelElement.className = 'label-box';
                labelElement.textContent = label.label_name;
                labelElement.style.backgroundColor = label.label_color || '#444';
                labelElement.dataset.id = label.label_id;
                
                // Add double-click for editing
                labelElement.addEventListener('dblclick', () => {
                    showEditPopup(label.label_id);
                });
                
                labelElement.addEventListener('click', () => {
                    selectedLabelId = label.label_id;
                    document.querySelectorAll('.label-box').forEach(box => {
                        box.classList.remove('active');
                    });
                    labelElement.classList.add('active');
                });
                
                labelList.appendChild(labelElement);
            });
        }
        
        // Canvas event handlers
        function setupCanvasEvents() {
            canvas.removeEventListener('mousedown', startDrawing);
            canvas.removeEventListener('mousemove', draw);
            canvas.removeEventListener('mouseup', stopDrawing);
            canvas.removeEventListener('mouseout', stopDrawing);
        
            canvas.addEventListener('mousedown', startDrawing);
            canvas.addEventListener('mousemove', draw);
            canvas.addEventListener('mouseup', stopDrawing);
            canvas.addEventListener('mouseout', stopDrawing);
        }
        
        
        function startDrawing(e) {
            if (!selectedLabelId) {
                alert('Please select a label first');
                return;
            }            
            if (!selectedLabelId) {
                alert('Please select a label first');
                return;
            }
            
            isDrawing = true;
            const rect = canvas.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;
        }
        
        function draw(e) {
            if (!isDrawing || !currentImageElement) return;
        
            const rect = canvas.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;
        
            redrawCanvas();
        
            const width = currentX - startX;
            const height = currentY - startY;
        
            ctx.beginPath();
            ctx.rect(startX, startY, width, height);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#00ff00';
            ctx.stroke();
        
            ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
            ctx.fillRect(startX, startY, width, height);
        }
        
        async function stopDrawing(e) {
            if (!isDrawing) return;
        
            isDrawing = false;
            const rect = canvas.getBoundingClientRect();
            const endX = e.clientX - rect.left;
            const endY = e.clientY - rect.top;
        
            const x = Math.min(startX, endX);
            const y = Math.min(startY, endY);
            const width = Math.abs(endX - startX);
            const height = Math.abs(endY - startY);
        
            if (width > 10 && height > 10) {
                const newRect = {
                    x, y, width, height,
                    labelId: selectedLabelId
                };
        
                try {
                    await saveAnnotation(newRect); // 💾 First try saving
        
                    await loadAnnotations(currentImageId); // 🔄 Then reload fresh from server
                } catch (error) {
                    console.error('Failed to save annotation:', error);
                    showErrorToUser('Failed to save annotation. Please try again.');
                }
            }
        
            redrawCanvas();
        }
        
        function redrawCanvas() {
            if (!currentImageElement) return;
        
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(currentImageElement, 0, 0);
            drawRectangles();
        }
        
        
        function drawRectangles() {
            rectangles.forEach(rect => {
                const label = labels.find(l => l.label_id === rect.labelId);
                if (!label) return;
                
                ctx.beginPath();
                ctx.rect(rect.x, rect.y, rect.width, rect.height);
                ctx.lineWidth = 2;
                ctx.strokeStyle = label.label_color || '#00ff00';
                ctx.stroke();
                
                // Label text
                ctx.fillStyle = label.label_color || '#00ff00';
                ctx.font = '12px Arial';
                ctx.fillText(label.label_name, rect.x + 5, rect.y + 15);
            });
        }

        async function saveAnnotation(rect) {
            if (!currentImageId || !rect) return;
        
            try {
                const x_min = rect.x / canvas.width;
                const y_min = rect.y / canvas.height;
                const x_max = (rect.x + rect.width) / canvas.width;
                const y_max = (rect.y + rect.height) / canvas.height;
        
                const annotationData = {
                    image_id: currentImageId,
                    label_id: rect.labelId,
                    x_min,
                    y_min,
                    x_max,
                    y_max
                };
        
                console.log('📦 Sending annotation:', annotationData); // <--- Add this!
        
                const response = await fetch(`${serverUrl}/api/annotations`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(annotationData)
                });
        
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to save annotation');
                }
        
                console.log("✅ Annotation saved");
            } catch (error) {
                console.error('Error saving annotation:', error);
                showErrorToUser('Failed to save annotation.');
            }
        }        
        
        
        // Save annotation to database
        async function loadAnnotations(imageId) {
          try {
              const response = await fetch(`${serverUrl}/api/images/${imageId}/annotations`, {
                  headers: { 
                      'Authorization': `Bearer ${localStorage.getItem('token')}`
                  }
              });
              
              if (!response.ok) {
                  throw new Error(`Failed to load annotations: ${response.status}`);
              }
      
              const annotations = await response.json();
              console.log('📦 Loaded annotations:', annotations);
              
              // Convert normalized coordinates to canvas coordinates
              rectangles = annotations.map(ann => ({
                x: ann.x_min * canvas.width,
                y: ann.y_min * canvas.height,
                width: (ann.x_max - ann.x_min) * canvas.width,
                height: (ann.y_max - ann.y_min) * canvas.height,
                labelId: ann.label_id
              }));              
              
              redrawCanvas();
              renderDrawnLabels();
              
          } catch (error) {
              console.error('Error loading annotations:', error);
              showErrorToUser('Failed to load annotations. Please try again.');
          }
      }
        
        // Label creation popup
        function showPopup() {
            document.getElementById('labelName').value = '';
            document.getElementById('labelColor').value = '#00ff00';
            document.getElementById('labelPopup').style.display = 'block';
        }
        
        function closePopup() {
            document.getElementById('labelPopup').style.display = 'none';
        }
        
        async function createLabel() {
          const name = document.getElementById('labelName').value.trim();
          const color = document.getElementById('labelColor').value;
          
          if (!name) {
            alert('Please enter a label name');
            return;
          }
        
          try {
            const response = await fetch(`${serverUrl}/api/labels`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                project_id: currentProjectId,
                label_name: name,
                label_color: color,
                label_category: 'object' // or your default category
              })
            });
        
            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Failed to create label');
            
            await loadLabels(currentProjectId);
            renderLabelList();
            closePopup();
            
          } catch (error) {
            console.error('Error:', error);
            alert(`Error creating label: ${error.message}`);
          }
        }

        // Edit label popup
        function showEditPopup(labelId) {
            const label = labels.find(l => l.label_id === labelId);
            if (!label) return;
            
            document.getElementById('editLabelName').value = label.label_name;
            document.getElementById('editLabelColor').value = label.label_color || '#00ff00';
            currentLabelId = labelId;
            document.getElementById('editLabelPopup').style.display = 'block';
        }
        
        function closeEditPopup() {
            document.getElementById('editLabelPopup').style.display = 'none';
        }
        
        async function updateLabel() {
            const name = document.getElementById('editLabelName').value.trim();
            const color = document.getElementById('editLabelColor').value;
            
            if (!name) {
                alert('Please enter a label name');
                return;
            }
            
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    alert('Please login first');
                    window.location.href = 'login.html';
                    return;
                }
                
                const response = await fetch(`${serverUrl}/api/labels/${currentLabelId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        label_name: name,
                        label_color: color
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to update label');
                }
                
                const updatedLabel = await response.json();
                const index = labels.findIndex(l => l.label_id === currentLabelId);
                if (index !== -1) {
                    labels[index] = updatedLabel;
                }
                renderLabelList();
                closeEditPopup();
            } catch (error) {
                console.error('Error updating label:', error);
                alert(error.message || 'Failed to update label');
            }
        }

        // Edit label popup
        function showEditPopup(labelId) {
          const label = labels.find(l => l.label_id === labelId);
          if (!label) return;
          
          document.getElementById('editLabelName').value = label.label_name;
          document.getElementById('editLabelColor').value = label.label_color || '#00ff00';
          currentLabelId = labelId;
          document.getElementById('editLabelPopup').style.display = 'block';
      }
      
      function closeEditPopup() {
          document.getElementById('editLabelPopup').style.display = 'none';
      }
      
      async function updateLabel() {
          const name = document.getElementById('editLabelName').value.trim();
          const color = document.getElementById('editLabelColor').value;
          
          if (!name) {
              alert('Please enter a label name');
              return;
          }
          
          try {
              const token = localStorage.getItem('token');
              if (!token) {
                  alert('Please login first');
                  window.location.href = 'login.html';
                  return;
              }
              
              const response = await fetch(`${serverUrl}/api/labels/${currentLabelId}`, {
                  method: 'PUT',
                  headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                      label_name: name,
                      label_color: color
                  })
              });
              
              if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.message || 'Failed to update label');
              }
              
              const updatedLabel = await response.json();
              const index = labels.findIndex(l => l.label_id === currentLabelId);
              if (index !== -1) {
                  labels[index] = updatedLabel;
              }
              renderLabelList();
              closeEditPopup();
          } catch (error) {
              console.error('Error updating label:', error);
              alert(error.message || 'Failed to update label');
          }
      }

      function renderDrawnLabels() {
        drawnLabels.innerHTML = '';
    
        rectangles.forEach((rect, index) => {
            const label = labels.find(l => l.label_id === rect.labelId);
            if (!label) return;
    
            const item = document.createElement('div');
            item.className = 'drawn-label-item';
            item.style.background = label.label_color || '#444';
            item.style.color = 'white';
            item.style.padding = '5px';
            item.style.marginBottom = '4px';
            item.textContent = `${label.label_name} (${Math.round(rect.x)}, ${Math.round(rect.y)})`;
    
            // Add delete button
            const delButton = document.createElement('button');
            delButton.textContent = '🗑️';
            delButton.style.marginLeft = '10px';
            delButton.onclick = () => deleteAnnotation(index);
    
            item.appendChild(delButton);
            drawnLabels.appendChild(item);
        });
    }

    
    async function deleteAnnotation(index) {
        const confirmDelete = confirm('Are you sure you want to delete this annotation?');
        if (!confirmDelete) return;
    
        const rect = rectangles[index];
        if (!rect) return;
    
        // TODO: Send delete request to server if you want.
    
        rectangles.splice(index, 1);
        redrawCanvas();
        renderDrawnLabels();
    }
    

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentProjectId = urlParams.get('id');
    if (!currentProjectId) {
        alert('No project selected.');
        window.location.href = 'projects.html';
        return;
    }
    try {
        await loadProject(currentProjectId);
        await loadImages(currentProjectId);
        await loadLabels(currentProjectId);
        setupCanvasEvents();
    } catch (error) {
        console.error('Initialization error:', error);
        showErrorToUser('Failed to initialize application.');
    }
});
