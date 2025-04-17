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

// Canvas setup
const canvas = document.getElementById('imageCanvas');
const ctx = canvas.getContext('2d');
const imageList = document.getElementById('imageList');
const labelList = document.getElementById('labelList');
const drawnLabels = document.getElementById('drawnLabels');

        // Back button functionality
        document.getElementById('backButton').addEventListener('click', () => {
            window.location.href = `Labeling.html?id=${currentProjectId}`;
        });
        
        // Helper function to show errors to user
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
  
  async function loadImages(projectId) {
    try {
      const response = await fetch(`${serverUrl}/api/images/${projectId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

  
      if (!response.ok) throw new Error('Failed to load images');
  
      const images = await response.json();
      renderImageList(images);
  
      if (images.length > 0) {
        await loadImage(images[0].image_id);
      }
    } catch (error) {
      console.error('Error loading images:', error);
      throw error;
    }
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
        
        // Render image thumbnails
        function renderImageList(images) {
            imageList.innerHTML = '';
            images.forEach(image => {
              const imgElement = document.createElement('img');
              
              // Ensure proper URL formatting
              let imageUrl = image.file_path;
              if (!imageUrl.startsWith('/uploads/')) {
                imageUrl = `/uploads/${imageUrl}`;
              }
              imageUrl = imageUrl.replace(/([^:]\/)\/+/g, '$1');
              
              imgElement.src = new URL(imageUrl, serverUrl).href;
              imgElement.className = 'image-thumbnail';
              imgElement.dataset.id = image.image_id;
              imgElement.addEventListener('click', () => loadImage(image.image_id));
              
              imgElement.onerror = () => {
                console.error("Thumbnail failed to load:", imgElement.src);
                imgElement.src = 'placeholder.jpg'; // Fallback image
              };
              
              imageList.appendChild(imgElement);
            });
          }

          const fileExists = await checkFileExists(fullImageUrl);
if (!fileExists) {
    throw new Error(`Image file not found at: ${fullImageUrl}`);
}

// Helper function
async function checkFileExists(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch (e) {
        return false;
    }
}
        
        // Load specific image
        async function loadImage(imageId) {
            try {
                currentImageId = imageId;
                const token = localStorage.getItem('token');
        
                // 1. Fetch image data
                const imageResponse = await fetch(`${serverUrl}/api/images/${imageId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (!imageResponse.ok) {
                    throw new Error(`HTTP error! status: ${imageResponse.status}`);
                }
        
                const imageData = await imageResponse.json();
                
                // Check if we got valid data
                if (!imageData || Object.keys(imageData).length === 0) {
                    throw new Error("Empty response from server");
                }
        
                console.log("Image data received:", imageData);
        
                // Rest of your existing image loading logic...
                // ... [keep the existing path handling and image loading code]
                
            } catch (error) {
                console.error('🚨 Error loading image:', error);
                showErrorToUser(`Error: ${error.message}`);
                
                // Optional: Show more details in console for debugging
                console.log('Full error details:', {
                    imageId,
                    error,
                    response: await imageResponse?.text()
                });
            }
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
            
            isDrawing = true;
            const rect = canvas.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;
        }
        
        function draw(e) {
            if (!isDrawing) return;
            
            const rect = canvas.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;
            
            // Clear and redraw
            redrawCanvas();
            
            // Draw current rectangle
            ctx.beginPath();
            ctx.rect(startX, startY, currentX - startX, currentY - startY);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#00ff00';
            ctx.stroke();
        }
        
        function stopDrawing(e) {
            if (!isDrawing) return;
            
            isDrawing = false;
            const rect = canvas.getBoundingClientRect();
            const endX = e.clientX - rect.left;
            const endY = e.clientY - rect.top;
            
            // Normalize coordinates (startX/Y might be greater than endX/Y)
            const x = Math.min(startX, endX);
            const y = Math.min(startY, endY);
            const width = Math.abs(endX - startX);
            const height = Math.abs(endY - startY);
            
            // Only save if significant size
            if (width > 10 && height > 10) {
                const newRect = {
                    x, y, width, height,
                    labelId: selectedLabelId
                };
                rectangles.push(newRect);
                
                // Save to database
                saveAnnotation(newRect);
            }
            
            redrawCanvas();
        }
        
        function redrawCanvas() {
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Redraw image
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
                drawRectangles();
            };
            img.src = canvas.toDataURL();
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
        
        // Save annotation to database
        async function saveAnnotation(rect) {
            try {
              // Validate required fields
              if (!currentImageId || !rect.labelId) {
                throw new Error("Missing image ID or label ID");
              }
          
              // Calculate normalized coordinates
              const annotation = {
                image_id: currentImageId,
                label_id: rect.labelId,
                x_min: rect.x / canvas.width,
                x_max: (rect.x + rect.width) / canvas.width,
                y_min: rect.y / canvas.height,
                y_max: (rect.y + rect.height) / canvas.height
              };
          
              console.log("Saving annotation:", annotation); // Debug log
          
              const response = await fetch(`${serverUrl}/api/annotations`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(annotation)
              });
          
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("Annotation save failed:", errorData);
                throw new Error(errorData.message || `Server error: ${response.status}`);
              }
          
              const result = await response.json();
              console.log('Annotation saved successfully:', result);
              return result;
          
            } catch (error) {
              console.error('Error saving annotation:', error);
              showErrorToUser(`Failed to save annotation: ${error.message}`);
              
              // Remove the rectangle if save failed
              rectangles = rectangles.filter(r => r !== rect);
              redrawCanvas();
              
              throw error; // Re-throw for further handling if needed
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