# 🎬 YouTube Watch Party

A real-time YouTube Watch Party web application where users can create rooms, invite friends with a room code, and watch YouTube videos together.

## 📌 Project Overview

YouTube Watch Party allows users to join a shared room and watch the same YouTube video. The application uses React for the frontend and Node.js, Express, and Socket.IO for real-time communication.

## ✨ Features

- **Create Room:** Create a room with a unique room code.
- **Join Room:** Join an existing room using its room code.
- **Real-Time Participants:** View room participants and their roles.
- **YouTube Video Sharing:** Change the video for everyone in the room.
- **Playback Synchronization:** Synchronize play and pause actions between users.
- **Role Management:** Host can assign or remove the Moderator role.
- **Remove Participants:** Host can remove users from the room.
- **Room Management:** Update participants when users leave or disconnect.
- **Host Disconnect Handling:** Notify participants when the Host leaves.
- **Responsive UI:** Dark-themed interface for desktop and smaller screens.

## 🛠️ Technologies Used

**Frontend**
- React
- Vite
- JavaScript
- CSS
- Socket.IO Client
- React YouTube

**Backend**
- Node.js
- Express.js
- Socket.IO
- CORS

## 📁 Project Structure

```text
WatchParty/
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── style.css
│   ├── index.html
│   └── package.json
├── server/
│   ├── index.js
│   └── package.json
├── .gitignore
└── README.md
```

## ⚙️ Installation and Setup

### Prerequisites

- Node.js and npm
- Git
- A modern web browser

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd WatchParty
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with your GitHub repository URL.

### 2. Install Dependencies

Open a terminal in the project root.

Install frontend dependencies:

```bash
cd client
npm install
```

Start the frontend:

```bash
npm run dev
```

The frontend will normally run at:

`http://localhost:5173`

### 3. Start the Backend

Open a **second terminal** in the project root:

```bash
cd server
npm install
node index.js
```

The backend will run at:

`http://localhost:3000`

Keep both terminals running while using the application.

## 🧪 How to Test

1. Open the frontend in a browser.
2. Enter a username and create a room.
3. Copy the room code.
4. Open another browser or an Incognito window.
5. Join the room using the same room code.
6. Test video changes and playback synchronization.
7. Test Moderator assignment and participant removal.
8. Test what happens when the Host leaves the room.

## 🔐 Roles and Permissions

- **Host:** Creates the room, manages roles, removes participants, and controls videos.
- **Moderator:** Can control playback and change videos.
- **Participant:** Joins the room and watches the shared video.

## 🚀 Future Improvements

- Deploy the frontend and backend online.
- Add chat and emoji reactions.
- Improve playback synchronization for seeking and late joins.
- Add better connection recovery and error handling.
- Improve accessibility and mobile user experience.

## 👨‍💻 RITESH KUMAR KASAUDHAN

**Your Name**

GitHub: YOUR_GITHUB_USERNAME

---

Built with React, Node.js, Express, and Socket.IO.
