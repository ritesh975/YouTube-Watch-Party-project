
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import YouTube from 'react-youtube';
import './style.css';

const socket = io('http://localhost:3000');

function App() {
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [activeRoom, setActiveRoom] = useState('');
  const [role, setRole] = useState('');
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(socket.connected);
  const [videoId, setVideoId] = useState('dQw4w9WgXcQ');
  const [videoUrl, setVideoUrl] = useState('');

  const playerRef = useRef(null);

  useEffect(() => {
    function onConnect() {
      setConnected(true);
    }

    function onDisconnect() {
      setConnected(false);
    }

    function onUserJoined(data) {
      setParticipants(data.participants || []);
    }

    function onUserLeft(data) {
      setParticipants(data.participants || []);
    }

    function onVideoChanged(data) {
      if (data.videoId) {
        setVideoId(data.videoId);
      }
    }

    function onPlaybackChanged(data) {
      const player = playerRef.current;

      if (!player || typeof data.currentTime !== 'number') {
        return;
      }

      player.seekTo(data.currentTime, true);

      if (data.isPlaying) {
        player.playVideo();
      } else {
        player.pauseVideo();
      }
    }

    function onRoleAssigned(data) {
      setParticipants(data.participants || []);

      if (data.userId === socket.id) {
        setRole(data.role);
      }
    }

    function onRemovedFromRoom() {
      setActiveRoom('');
      setRole('');
      setParticipants([]);
      setVideoUrl('');
      setError('You have been removed from the room.');
    }

    function onRoomClosed(data) {
      setActiveRoom('');
      setRole('');
      setParticipants([]);
      setVideoUrl('');
      setError(data?.message || 'The room has been closed.');
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('user_joined', onUserJoined);
    socket.on('user_left', onUserLeft);
    socket.on('video_changed', onVideoChanged);
    socket.on('playback_changed', onPlaybackChanged);
    socket.on('role_assigned', onRoleAssigned);
    socket.on('removed_from_room', onRemovedFromRoom);
    socket.on('room_closed', onRoomClosed);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('user_joined', onUserJoined);
      socket.off('user_left', onUserLeft);
      socket.off('video_changed', onVideoChanged);
      socket.off('playback_changed', onPlaybackChanged);
      socket.off('role_assigned', onRoleAssigned);
      socket.off('removed_from_room', onRemovedFromRoom);
      socket.off('room_closed', onRoomClosed);
    };
  }, []);

  function createRoom() {
    if (!username.trim()) {
      setError('Please enter your name.');
      return;
    }

    if (!socket.connected) {
      setError('Backend is not connected. Please try again.');
      return;
    }

    socket.emit('create_room', { username: username.trim() }, (response) => {
      if (!response || response.error) {
        setError(response?.error || 'Unable to create room.');
        return;
      }

      setActiveRoom(response.roomId);
      setRole(response.role);
      setParticipants(response.participants || []);
      setVideoId(response.videoId || 'dQw4w9WgXcQ');
      setError('');
    });
  }

  function joinRoom() {
    if (!username.trim() || !roomCode.trim()) {
      setError('Please enter your name and room code.');
      return;
    }

    if (!socket.connected) {
      setError('Backend is not connected. Please try again.');
      return;
    }

    socket.emit(
      'join_room',
      {
        username: username.trim(),
        roomId: roomCode.trim().toUpperCase(),
      },
      (response) => {
        if (!response || response.error) {
          setError(response?.error || 'Unable to join room.');
          return;
        }

        setActiveRoom(response.roomId);
        setRole(response.role);
        setParticipants(response.participants || []);
        setVideoId(response.videoId || 'dQw4w9WgXcQ');
        setError('');
      }
    );
  }

  function changeVideo() {
    if (!['Host', 'Moderator'].includes(role)) {
      setError('You do not have permission to change the video.');
      return;
    }

    const input = videoUrl.trim();

    let newVideoId = null;

    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
      newVideoId = input;
    } else {
      try {
        const url = new URL(input);
        const host = url.hostname.toLowerCase();

        if (host === 'youtu.be' || host === 'www.youtu.be') {
          newVideoId = url.pathname.split('/').filter(Boolean)[0];
        } else if (
          [
            'youtube.com',
            'www.youtube.com',
            'm.youtube.com',
            'youtube-nocookie.com',
            'www.youtube-nocookie.com',
          ].includes(host)
        ) {
          if (url.pathname === '/watch') {
            newVideoId = url.searchParams.get('v');
          } else {
            const parts = url.pathname.split('/').filter(Boolean);

            if (['embed', 'shorts', 'live'].includes(parts[0])) {
              newVideoId = parts[1];
            }
          }
        }
      } catch {
        newVideoId = null;
      }
    }

    if (
      typeof newVideoId !== 'string' ||
      !/^[a-zA-Z0-9_-]{11}$/.test(newVideoId)
    ) {
      setError('Please enter a valid YouTube video URL.');
      return;
    }

    socket.emit(
      'change_video',
      { roomId: activeRoom, videoId: newVideoId },
      (response) => {
        if (!response || response.error) {
          setError(response?.error || 'Unable to change video.');
          return;
        }

        setVideoId(newVideoId);
        setVideoUrl('');
        setError('');
      }
    );
  }

  function assignRole(person, newRole) {
    socket.emit(
      'assign_role',
      { userId: person.id, role: newRole },
      (response) => {
        if (!response || response.error) {
          setError(response?.error || 'Unable to update role.');
          return;
        }

        setError('');
      }
    );
  }

  function removeParticipant(person) {
    const confirmed = window.confirm(
      `Remove ${person.username} from this room?`
    );

    if (!confirmed) return;

    socket.emit(
      'remove_participant',
      { userId: person.id },
      (response) => {
        if (!response || response.error) {
          setError(response?.error || 'Unable to remove participant.');
          return;
        }

        setError('');
      }
    );
  }

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(activeRoom);
      alert('Room code copied!');
    } catch {
      alert(`Your room code is: ${activeRoom}`);
    }
  }

  function leaveRoom() {
    socket.emit('leave_room', () => {
      setActiveRoom('');
      setRole('');
      setParticipants([]);
      setVideoUrl('');
      setError('');
      playerRef.current = null;
    });
  }

  return (
    <main className="app">
      <header className="header">
        <h1>WatchParty</h1>
        <span>
          {connected ? '🟢 Connected' : '🔴 Connecting...'}
        </span>
      </header>

      {!activeRoom ? (
        <section className="card">
          <h2>Enjoy videos together 🎬</h2>
          <p>Create a room or join your friends.</p>

          <label htmlFor="username">Your name</label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
          />

          <button className="primary" onClick={createRoom}>
            Create Room
          </button>

          <div className="separator">OR JOIN A ROOM</div>

          <label htmlFor="roomCode">Room code</label>
          <input
            id="roomCode"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            placeholder="Enter room code"
          />

          <button className="secondary" onClick={joinRoom}>
            Join Room
          </button>

          {error && <p className="error">{error}</p>}
        </section>
      ) : (
        <section className="card room">
          <span className="badge">{role}</span>
          <h2>You're in a Watch Party!</h2>
          <p>Welcome, {username}.</p>

          <div className="room-code">
            <span>Room Code</span>
            <strong>{activeRoom}</strong>
          </div>

          <button className="primary" onClick={copyRoomCode}>
            Copy Room Code
          </button>

          <h3>Participants ({participants.length})</h3>

          {participants.map((person) => (
            <div className="participant-row" key={person.id}>
              <p>
                {person.username} — {person.role}
              </p>

              {role === 'Host' && person.id !== socket.id && (
                <div className="participant-actions">
                  <button
                    className="secondary"
                    onClick={() =>
                      assignRole(
                        person,
                        person.role === 'Moderator'
                          ? 'Participant'
                          : 'Moderator'
                      )
                    }
                  >
                    {person.role === 'Moderator'
                      ? 'Make Participant'
                      : 'Make Moderator'}
                  </button>

                  <button
                    className="secondary"
                    onClick={() => removeParticipant(person)}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}

          {['Host', 'Moderator'].includes(role) && (
            <div className="video-controls">
              <input
                type="text"
                placeholder="Paste YouTube video URL"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />

              <button className="primary" onClick={changeVideo}>
                Change Video
              </button>
            </div>
          )}

          <div className="video-placeholder">
            <YouTube
              videoId={videoId}
              onReady={(event) => {
                playerRef.current = event.target;
              }}
              onStateChange={(event) => {
                if (!['Host', 'Moderator'].includes(role) || !activeRoom) {
                  return;
                }

                if (event.data !== 1 && event.data !== 2) {
                  return;
                }

                socket.emit('sync_playback', {
                  roomId: activeRoom,
                  currentTime: event.target.getCurrentTime(),
                  isPlaying: event.data === 1,
                });
              }}
              opts={{
                width: '100%',
                height: '360',
                playerVars: {
                  autoplay: 0,
                  controls: 1,
                },
              }}
            />
          </div>

          {error && <p className="error">{error}</p>}

          <button className="secondary" onClick={leaveRoom}>
            Leave Room
          </button>
        </section>
      )}
    </main>
  );
}

export default App;
