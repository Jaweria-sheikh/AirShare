 const firebaseConfig = {
    apiKey: "AIzaSyCvydbP_VIn6Om5CtrjGC69_XWS_NRgoYo",
    authDomain: "chat-app-55ac0.firebaseapp.com",
    databaseURL: "https://chat-app-55ac0-default-rtdb.firebaseio.com",
    projectId: "chat-app-55ac0",
    storageBucket: "chat-app-55ac0.firebasestorage.app",
    messagingSenderId: "1067770114636",
    appId: "1:1067770114636:web:a584f5f7ee3738d8967ae9",
    measurementId: "G-BHQF2PWXVY"
  };

const CLOUDINARY_CLOUD_NAME = "dcp4cddp"; 
const CLOUDINARY_UPLOAD_PRESET = "ta3aj5hs"; 

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// State Variables
let currentRoom = "default-room";
let activeUploadsCount = parseInt(localStorage.getItem(`uploads_${currentRoom}`)) || 0;
let allFeedItems = [];
let currentFilter = "all";
let isRemoteUpdate = false;

// DOM Elements
const roomInput = document.getElementById("roomInput");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const currentRoomDisplay = document.getElementById("currentRoomDisplay");
const sharedText = document.getElementById("sharedText");
const clearTextBtn = document.getElementById("clearTextBtn");
const copyTextBtn = document.getElementById("copyTextBtn");
const textSyncStatus = document.getElementById("textSyncStatus");
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const uploadProgressContainer = document.getElementById("uploadProgressContainer");
const uploadProgressBar = document.getElementById("uploadProgressBar");
const uploadStatusText = document.getElementById("uploadStatusText");
const feedContainer = document.getElementById("feedContainer");
const clearFeedBtn = document.getElementById("clearFeedBtn");
const activeUploadsCountEl = document.getElementById("activeUploadsCount");
activeUploadsCountEl.textContent = activeUploadsCount;
const filterBtns = document.querySelectorAll(".filter-btn");

// Theme Toggle DOM Elements
const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeIcon = document.getElementById("themeIcon");
const htmlElement = document.documentElement;

// light and dark theme toggle
const savedTheme = localStorage.getItem("airshare_theme") || "dark";
if (savedTheme === "light") {
    htmlElement.setAttribute("data-theme", "light");
    if (themeIcon) themeIcon.classList.replace("fa-moon", "fa-sun");
} else {
    htmlElement.removeAttribute("data-theme");
    if (themeIcon) themeIcon.classList.replace("fa-sun", "fa-moon");
}

if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
        if (htmlElement.getAttribute("data-theme") === "light") {
            htmlElement.removeAttribute("data-theme");
            localStorage.setItem("airshare_theme", "dark");
            if (themeIcon) themeIcon.classList.replace("fa-sun", "fa-moon");
        } else {
            htmlElement.setAttribute("data-theme", "light");
            localStorage.setItem("airshare_theme", "light");
            if (themeIcon) themeIcon.classList.replace("fa-moon", "fa-sun");
        }
    });
}

// Mobile Sidebar Toggle Logic
const mobileMenuToggle = document.getElementById("mobileMenuToggle");
const sidebar = document.querySelector(".sidebar");
const toggleIcon = mobileMenuToggle ? mobileMenuToggle.querySelector("i") : null;

if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener("click", () => {
        sidebar.classList.toggle("mobile-open");
        
        // Switch between hamburger bars and close cross icon
        if (sidebar.classList.contains("mobile-open")) {
            toggleIcon.classList.remove("fa-bars");
            toggleIcon.classList.add("fa-xmark");
        } else {
            toggleIcon.classList.remove("fa-xmark");
            toggleIcon.classList.add("fa-bars");
        }
    });

    // Close sidebar when clicking outside on mobile viewports
    document.addEventListener("click", (e) => {
        if (window.innerWidth <= 900) {
            if (!sidebar.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                sidebar.classList.remove("mobile-open");
                if (toggleIcon) {
                    toggleIcon.classList.remove("fa-xmark");
                    toggleIcon.classList.add("fa-bars");
                }
            }
        }
    });
}

const closeSidebarBtn = document.getElementById("closeSidebarBtn");

if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener("click", () => {
        sidebar.classList.remove("mobile-open");
        
        const mobileMenuToggle = document.getElementById("mobileMenuToggle");
        if (mobileMenuToggle) {
            const toggleIcon = mobileMenuToggle.querySelector("i");
            if (toggleIcon) {
                toggleIcon.classList.remove("fa-xmark");
                toggleIcon.classList.add("fa-bars");
            }
        }
    });
}

// ROOM MANAGEMENT & REALTIME SYNC
function switchRoom(newRoom) {
    if (!newRoom.trim()) return;
    currentRoom = newRoom.trim().toLowerCase().replace(/\s+/g, '-');
    if (currentRoomDisplay) currentRoomDisplay.textContent = currentRoom;
    roomInput.value = currentRoom;

    activeUploadsCount = parseInt(localStorage.getItem(`uploads_${currentRoom}`)) || 0;
    activeUploadsCountEl.textContent = activeUploadsCount;

    if (sidebar) {
        sidebar.classList.remove("mobile-open");
    }
    if (toggleIcon) {
        toggleIcon.classList.remove("fa-xmark");
        toggleIcon.classList.add("fa-bars");
    }

    attachFirebaseListeners();
}

joinRoomBtn.addEventListener("click", () => {
    switchRoom(roomInput.value);
});

roomInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        switchRoom(roomInput.value);
    }
});

let textRef, filesRef;

function attachFirebaseListeners() {
    if (textRef) textRef.off();
    if (filesRef) filesRef.off();

    textRef = db.ref(`rooms/${currentRoom}/text`);
    filesRef = db.ref(`rooms/${currentRoom}/files`);

    // Listen for real-time text synchronization
    textRef.on("value", (snapshot) => {
        const val = snapshot.val() || "";
        if (sharedText.value !== val) {
            isRemoteUpdate = true;
            sharedText.value = val;
            isRemoteUpdate = false;
        }
        textSyncStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i> Synced';
    });

    // Listen for real-time files & shared items feed
    filesRef.on("value", (snapshot) => {
        const data = snapshot.val() || {};
        allFeedItems = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        })).reverse(); // Newest first

        renderFeed();
    });
}

// text sharing logic
let typingTimer;
sharedText.addEventListener("input", () => {
    if (isRemoteUpdate) return;
    
    textSyncStatus.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> Syncing...';
    clearTimeout(typingTimer);
    
    typingTimer = setTimeout(() => {
        textRef.set(sharedText.value).then(() => {
            textSyncStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i> Synced';
        });
    }, 300); // Debounce to prevent flooding
});

clearTextBtn.addEventListener("click", () => {
    sharedText.value = "";
    textRef.set("");
});

clearFeedBtn.addEventListener("click", () => {
    if (allFeedItems.length === 0) {
        alert("The feed is already empty!");
        return;
    }
    
    if (confirm("Are you sure you want to clear all shared items in this room?")) {
        db.ref(`rooms/${currentRoom}/files`).remove().then(() => {
            activeUploadsCount = 0;
            activeUploadsCountEl.textContent = activeUploadsCount;
            localStorage.removeItem(`uploads_${currentRoom}`);
        }).catch((error) => {
            alert("Failed to clear feed: " + error.message);
        });
    }
});

// COPY BUTTON DELEGATION FOR SHARED FEED
feedContainer.addEventListener("click", (e) => {
    const copyBtn = e.target.closest(".copy-item-btn");
    if (!copyBtn) return;

    const textToCopy = copyBtn.getAttribute("data-clipboard");
    if (!textToCopy) {
        alert("Nothing to copy!");
        return;
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
        setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
        }, 2000);
    }).catch(err => {
        console.error("Failed to copy text: ", err);
        alert("Failed to copy to clipboard.");
    });
});

copyTextBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(sharedText.value).then(() => {
        const originalText = copyTextBtn.innerHTML;
        copyTextBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => {
            copyTextBtn.innerHTML = originalText;
        }, 2000);
    });
});

// FILE UPLOAD LOGIC (Cloudinary Integration)
dropZone.addEventListener("click", (e) => {
    if (e.target.tagName !== "LABEL") {
        fileInput.click();
    }
});

fileInput.addEventListener("change", (e) => {
    handleFiles(e.target.files);
});

// Drag and drop handlers
["dragenter", "dragover"].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add("dragover");
    }, false);
});

["dragleave", "drop"].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
    }, false);
});

dropZone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
});

async function handleFiles(files) {
    if (!files.length) return;

    for (let i = 0; i < files.length; i++) {
        await uploadToCloudinary(files[i]);
    }
    fileInput.value = ""; // Reset input
}

function uploadToCloudinary(file) {
    return new Promise((resolve, reject) => {
        const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

        uploadProgressContainer.classList.remove("hidden");
        document.querySelector(".drop-zone-content").classList.add("hidden");
        uploadStatusText.textContent = `Uploading ${file.name}...`;

        const xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);

        xhr.upload.onprogress = function(e) {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                uploadProgressBar.style.width = percentComplete + "%";
            }
        };

        xhr.onload = function() {
            uploadProgressContainer.classList.add("hidden");
            document.querySelector(".drop-zone-content").classList.remove("hidden");
            uploadProgressBar.style.width = "0%";

            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                saveFileMetadata({
                    name: file.name,
                    size: formatBytes(file.size),
                    type: getFileCategory(file.type),
                    url: response.secure_url,
                    timestamp: Date.now()
                });
                activeUploadsCount++;
                activeUploadsCountEl.textContent = activeUploadsCount;
                localStorage.setItem(`uploads_${currentRoom}`, activeUploadsCount);
            } else {
                alert("Upload failed. Verify your Cloudinary Cloud Name and Unsigned Upload Preset.");
                reject(xhr.statusText);
            }
        };

        xhr.onerror = function() {
            uploadProgressContainer.classList.add("hidden");
            document.querySelector(".drop-zone-content").classList.remove("hidden");
            alert("Network error during file upload.");
            reject("Network Error");
        };

        xhr.send(formData);
    });
}

function saveFileMetadata(fileData) {
    db.ref(`rooms/${currentRoom}/files`).push(fileData);
}

// FEED RENDERING & FILTERING
filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        filterBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.getAttribute("data-filter");
        renderFeed();
    });
});

function renderFeed() {
    const filteredItems = allFeedItems.filter(item => {
        if (currentFilter === "all") return true;
        return item.type === currentFilter;
    });

    if (filteredItems.length === 0) {
        feedContainer.innerHTML = `
            <div class="empty-feed">
                <i class="fa-solid fa-box-open"></i>
                <p>No items found for this filter.</p>
            </div>
        `;
        return;
    }

    feedContainer.innerHTML = filteredItems.map(item => `
        <div class="feed-item">
            <div class="item-info">
                <div class="item-icon">
                    <i class="${getFileIcon(item.type)}"></i>
                </div>
                <div class="item-details">
                    <div class="item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
                    <div class="item-meta">
                        <span>${item.size}</span>
                        <span>•</span>
                        <span>${formatTime(item.timestamp)}</span>
                    </div>
                </div>
            </div>
            <div class="item-actions">
                <a href="${item.url}" target="_blank" class="action-btn" title="View / Download" download>
                    <i class="fa-solid fa-download"></i>
                </a>
                <button class="copy-item-btn" data-clipboard="${item.url || item.text}" title="Copy Link/Text">
                    <i class="fa-solid fa-copy"></i> Copy
                </button>
            </div>
        </div>
    `).join("");
}

// utility helper
function getFileCategory(mimeType) {
    if (!mimeType) return "file";
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType === "application/pdf") return "pdf";
    return "file";
}

function getFileIcon(type) {
    switch(type) {
        case "image": return "fa-regular fa-image";
        case "video": return "fa-solid fa-video";
        case "pdf": return "fa-regular fa-file-pdf";
        default: return "fa-regular fa-file-lines";
    }
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Initialize application on load
attachFirebaseListeners();

