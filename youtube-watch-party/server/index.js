
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Frontend URLs allowed to connect to this backend.
const allowedOrigins = [
  'http://localhost:5173',
  process.env.CLIENT_URL,
];

const corsOptions = {
  origin: allowedOrigins.filter(Boolean),
  methods: ['GET', 'POST'],
};

app.use(cors(corsOptions));
app.use(express.json());

const io = new Server(server, {
  cors: corsOptions,
});

const rooms = new Map();

function getParticipants(room) {
  return Array.from(room.participants.values());
}

function canControl(user) {
  return user && ['Host', 'Moderator'].includes(user.role);
}

function sendError(callback, message) {
  if (typeof callback === 'function') {
    callback({ error: message });
  }
}

function getYouTubeVideoId(value) {
  if (typeof value !== 'string') return null;

  const input = value.trim();

  // Allow a direct 11-character YouTube video ID.
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }

  try {
    const url = new URL(input);
    let id = null;

    if (
      url.hostname === 'youtu.be' ||
      url.hostname === 'www.youtu.be'
    ) {
      id = url.pathname.split('/').filter(Boolean)[0];
    } else if (
      [
        'youtube.com',
        'www.youtube.com',
        'm.youtube.com',
        'youtube-nocookie.com',
        'www.youtube-nocookie.com',
      ].includes(url.hostname)
    ) {
      if (url.pathname === '/watch') {
        id = url.searchParams.get('v');
      } else {
        const parts = url.pathname.split('/').filter(Boolean);

        if (['embed', 'shorts', 'live'].includes(parts[0])) {
          id = parts[1];
        }
      }
    }

    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function removeParticipant(socket, roomId, room) {
  room.participants.delete(socket.id);
  socket.leave(roomId);
  socket.data.roomId = null;

  if (room.participants.size === 0) {
    rooms.delete(roomId);
    return;
  }

  io.to(roomId).emit('user_left', {
    userId: socket.id,
    participants: getParticipants(room),
  });
}

function leaveCurrentRoom(socket) {
  const roomId = socket.data.roomId;
  const room = rooms.get(roomId);

  if (!room) {
    socket.data.roomId = null;
    return;
  }

  // Close the room if its Host leaves.
  if (room.hostId === socket.id) {
    rooms.delete(roomId);
    socket.leave(roomId);
    socket.data.roomId = null;

    io.to(roomId).emit('room_closed', {
      message: 'The Host has left the room.',
    });

    return;
  }

  removeParticipant(socket, roomId, room);
}

app.get('/', (req, res) => {
  res.send('YouTube Watch Party backend is running!');
});

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.data.roomId = null;

  // Create a new room.
  socket.on('create_room', ({ username } = {}, callback) => {
    if (typeof username !== 'string' || !username.trim()) {
      return sendError(callback, 'Username is required.');
    }

    // A socket can belong to only one room at a time.
    leaveCurrentRoom(socket);

    let roomId;

    do {
      roomId = Math.random().toString(36).slice(2, 8).toUpperCase();
    } while (rooms.has(roomId));

    const host = {
      id: socket.id,
      username: username.trim().slice(0, 40),
      role: 'Host',
    };

    const room = {
      hostId: socket.id,
      videoId: '',
      currentTime: 0,
      isPlaying: false,
      participants: new Map([[socket.id, host]]),
    };

    rooms.set(roomId, room);
    socket.join(roomId);
    socket.data.roomId = roomId;

    callback?.({
      roomId,
      role: 'Host',
      participants: getParticipants(room),
      videoId: room.videoId,
      currentTime: room.currentTime,
      isPlaying: room.isPlaying,
    });

    console.log('Room created:', roomId);
  });

  // Join an existing room.
  socket.on('join_room', ({ roomId, username } = {}, callback) => {
    const id =
      typeof roomId === 'string' ? roomId.trim().toUpperCase() : '';

    const room = rooms.get(id);

    if (!room) {
      return sendError(callback, 'Room not found.');
    }

    if (typeof username !== 'string' || !username.trim()) {
      return sendError(callback, 'Username is required.');
    }

    leaveCurrentRoom(socket);

    const participant = {
      id: socket.id,
      username: username.trim().slice(0, 40),
      role: 'Participant',
    };

    room.participants.set(socket.id, participant);
    socket.join(id);
    socket.data.roomId = id;

    callback?.({
      roomId: id,
      role: participant.role,
      participants: getParticipants(room),
      videoId: room.videoId,
      currentTime: room.currentTime,
      isPlaying: room.isPlaying,
    });

    io.to(id).emit('user_joined', {
      participants: getParticipants(room),
    });
  });

  // Change the YouTube video.
  socket.on('change_video', ({ roomId, videoId } = {}, callback) => {
    const currentRoomId = socket.data.roomId;
    const room = rooms.get(currentRoomId);
    const user = room?.participants.get(socket.id);

    if (!room || !user || currentRoomId !== roomId) {
      return sendError(callback, 'You are not in this room.');
    }

    if (!canControl(user)) {
      return sendError(
        callback,
        'Only the Host or Moderator can change the video.'
      );
    }

    const validVideoId = getYouTubeVideoId(videoId);

    if (!validVideoId) {
      return sendError(
        callback,
        'Please enter a valid YouTube video URL or ID.'
      );
    }

    room.videoId = validVideoId;
    room.currentTime = 0;
    room.isPlaying = false;

    io.to(currentRoomId).emit('video_changed', {
      videoId: room.videoId,
    });

    io.to(currentRoomId).emit('playback_update', {
      type: 'change_video',
      videoId: room.videoId,
      currentTime: 0,
      isPlaying: false,
      by: user.username,
    });

    callback?.({ success: true, videoId: room.videoId });
  });

  // Synchronize playback state.
  socket.on(
    'sync_playback',
    ({ roomId, currentTime, isPlaying } = {}, callback) => {
      const currentRoomId = socket.data.roomId;
      const room = rooms.get(currentRoomId);
      const user = room?.participants.get(socket.id);

      if (!room || !user || currentRoomId !== roomId) {
        return sendError(callback, 'You are not in this room.');
      }

      if (!canControl(user)) {
        return sendError(callback, 'You cannot control playback.');
      }

      const time = Number(currentTime);

      if (
        !Number.isFinite(time) ||
        time < 0 ||
        typeof isPlaying !== 'boolean'
      ) {
        return sendError(callback, 'Invalid playback state.');
      }

      room.currentTime = time;
      room.isPlaying = isPlaying;

      socket.to(currentRoomId).emit('playback_changed', {
        currentTime: room.currentTime,
        isPlaying: room.isPlaying,
      });

      callback?.({ success: true });
    }
  );

  // General playback controls: play, pause, seek, change_video.
  socket.on('playback_action', (action = {}, callback) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    const user = room?.participants.get(socket.id);

    if (!room || !user) {
      return sendError(callback, 'You are not in a room.');
    }

    if (!canControl(user)) {
      return sendError(
        callback,
        'Only the Host or Moderator can control playback.'
      );
    }

    const { type } = action;

    if (!['play', 'pause', 'seek', 'change_video'].includes(type)) {
      return sendError(callback, 'Invalid playback action.');
    }

    if (type === 'seek' || type === 'pause') {
      if (action.currentTime !== undefined) {
        const time = Number(action.currentTime);

        if (!Number.isFinite(time) || time < 0) {
          return sendError(callback, 'Invalid playback position.');
        }

        room.currentTime = time;
      }
    }

    if (type === 'change_video') {
      const validVideoId = getYouTubeVideoId(action.videoId);

      if (!validVideoId) {
        return sendError(
          callback,
          'Please provide a valid YouTube video URL or ID.'
        );
      }

      room.videoId = validVideoId;
      room.currentTime = 0;
      room.isPlaying = false;
    }

    if (type === 'play') room.isPlaying = true;
    if (type === 'pause') room.isPlaying = false;

    const update = {
      type,
      videoId: room.videoId,
      currentTime: room.currentTime,
      isPlaying: room.isPlaying,
      by: user.username,
    };

    io.to(roomId).emit('playback_update', update);

    if (type === 'change_video') {
      io.to(roomId).emit('video_changed', {
        videoId: room.videoId,
      });
    }

    callback?.({ success: true });
  });

  // Only the Host can assign roles.
  socket.on('assign_role', ({ userId, role } = {}, callback) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    const requester = room?.participants.get(socket.id);
    const target = room?.participants.get(userId);

    if (!room || requester?.role !== 'Host') {
      return sendError(callback, 'Only the Host can assign roles.');
    }

    if (!target || !['Moderator', 'Participant'].includes(role)) {
      return sendError(callback, 'Invalid participant or role.');
    }

    if (target.id === room.hostId) {
      return sendError(callback, 'The Host role cannot be changed here.');
    }

    target.role = role;

    io.to(roomId).emit('role_assigned', {
      userId,
      username: target.username,
      role,
      participants: getParticipants(room),
    });

    callback?.({ success: true });
  });

  // Only the Host can remove another participant.
  socket.on('remove_participant', ({ userId } = {}, callback) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    const requester = room?.participants.get(socket.id);
    const target = room?.participants.get(userId);

    if (!room || requester?.role !== 'Host') {
      return sendError(callback, 'Only the Host can remove participants.');
    }

    if (!target || target.id === room.hostId) {
      return sendError(callback, 'Invalid participant.');
    }

    room.participants.delete(userId);

    const targetSocket = io.sockets.sockets.get(userId);

    if (targetSocket) {
      targetSocket.leave(roomId);
      targetSocket.data.roomId = null;
      targetSocket.emit('removed_from_room');
    }

    io.to(roomId).emit('user_left', {
      userId,
      participants: getParticipants(room),
    });

    if (room.participants.size === 0) {
      rooms.delete(roomId);
    }

    callback?.({ success: true });
  });

  // Leave the current room.
  socket.on('leave_room', (callback) => {
    leaveCurrentRoom(socket);
    callback?.({ success: true });
  });

  // Handle disconnections.
  socket.on('disconnect', () => {
    leaveCurrentRoom(socket);
    console.log('Disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
