import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import './App.css';
import logo from './logo.png'
import soundManager from './soundManager';
// import script from './script'

// ZMIEŃ TEN ADRES NA IP TWOJEJ VM!
const WEBSOCKET_URL = 'ws://192.168.254.103:8765';
console.log('WEBSOCKET_URL:', process.env.REACT_APP_WEBSOCKET_URL);
function App() {
  const [gameState, setGameState] = useState('menu'); // 'menu', 'waiting', 'playing', 'finished'
  const [nickname, setNickname] = useState('');
  const [socket, setSocket] = useState(null);
  const [myCode, setMyCode] = useState('');
  const [opponentCode, setOpponentCode] = useState('');
  const [task, setTask] = useState(null);
  const [opponent, setOpponent] = useState('');
  const [gameResult, setGameResult] = useState(null);
  const [message, setMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [showSoundSettings, setShowSoundSettings] = useState(false);
  const [volumeValues, setVolumeValues] = useState({
  master: 70,
  effects: 80,
  music: 50
});
  const socketRef = useRef(null);

  useEffect(() => {
  const initializeApp = async () => {
    await soundManager.init();
    
    setVolumeValues({
      master: Math.round(soundManager.getVolume('master') * 100),
      effects: Math.round(soundManager.getVolume('effects') * 100),
      music: Math.round(soundManager.getVolume('music') * 100)
    });
  };
  
  initializeApp();
  
  return () => {
    if (socketRef.current) {
      socketRef.current.close();
    }
  };
}, []);

  const connectToServer = () => {
    if (!nickname.trim()) {
      setMessage('Podaj swój nick!');
      soundManager.play('error');
      return;
    }
    
    console.log('Łączenie z serwerem:', WEBSOCKET_URL);
    const ws = new WebSocket(WEBSOCKET_URL);
    
    ws.onopen = () => {
      console.log('Połączono z serwerem');
      setConnectionStatus('connected');
      setSocket(ws);
      socketRef.current = ws;
      
      // Dołącz do kolejki
      ws.send(JSON.stringify({
        type: 'join_queue',
        nickname: nickname
      }));
      
      setGameState('waiting');
      setMessage('Szukanie przeciwnika...');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleServerMessage(data);
    };

    ws.onclose = () => {
      console.log('Rozłączono z serwerem');
      setConnectionStatus('disconnected');
      setSocket(null);
      socketRef.current = null;
      if (gameState !== 'menu') {
        setMessage('Połączenie zostało przerwane');
        setGameState('menu');
      }
    };

    ws.onerror = (error) => {
      console.error('Błąd WebSocket:', error);
      setMessage(`Błąd połączenia z serwerem (${WEBSOCKET_URL}). Sprawdź adres IP VM!`);
      setConnectionStatus('error');
    };
  };

  const handleServerMessage = (data) => {
    console.log('Otrzymana wiadomość:', data);
    
    switch (data.type) {
      case 'queue_joined':
        setMessage(data.message);
        break;
        
      case 'game_started':
        setGameState('playing');
        setTask(data.task);
        setOpponent(data.opponent);
        setMessage(`Gra rozpoczęta! Przeciwnik: ${data.opponent}`);
        setMyCode('// Napisz swoją funkcję tutaj\n');
        setOpponentCode('// Kod przeciwnika pojawi się tutaj\n');
        soundManager.loop('gamemusic');
        break;
        
      case 'opponent_code_update':
        setOpponentCode(data.code);
        break;
        
      case 'checking_solution':
        setMessage(data.message);
        break;
        
      case 'game_result':
        setGameResult(data.result);
        setMessage(data.message);
        setGameState('finished');
        soundManager.play(data.result === 'win' ? 'win' : 'loss');
        soundManager.stop('gamemusic');
        break;
        
      case 'solution_incorrect':
        setMessage(data.message);
        soundManager.play('error');
        setTimeout(() => setMessage(''), 5000); // Zwiększony czas wyświetlania
        break;
        
      case 'opponent_disconnected':
        setMessage(data.message);
        setGameState('finished');
        setGameResult('win');
        soundManager.play('win');
        soundManager.stop('gamemusic');
        break;
        
      case 'error':
        setMessage(`Błąd: ${data.message}`);
        soundManager.play('error');
        break;
        
      default:
        console.log('Nieznana wiadomość:', data);
    }
  };

  const updateCode = (value) => {
    setMyCode(value);
    if (socket && gameState === 'playing') {
      socket.send(JSON.stringify({
        type: 'code_update',
        code: value
      }));
    }
  };

  const submitSolution = () => {
    //tu dodac jeszcze trzeba
    if (socket && myCode.trim()) {
      socket.send(JSON.stringify({
        type: 'submit_solution',
        code: myCode
      }));
      setMessage('Sprawdzanie rozwiązania...');
    } else {
      setMessage('Napisz najpierw kod!');
    }
  };

  const resetGame = () => {
    setGameState('menu');
    setTask(null);
    setOpponent('');
    setGameResult(null);
    setMessage('');
    setMyCode('');
    setOpponentCode('');
    soundManager.stop('gamemusic');
    if (socket) {
      socket.close();
    }
  };

  const renderMenu = () => (
    <div className="menu-container">
      <img src={logo} />
      <div className="connection-info">
        <p>Serwer: {WEBSOCKET_URL}</p>
        <p>Status: <span className={`status-${connectionStatus}`}>{connectionStatus}</span></p>
      </div>
      <div className="menu-form">
        <input
          type="text"
          placeholder="Wpisz swój nick"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && connectToServer()}
        />
        <button onClick={connectToServer} disabled={connectionStatus === 'connected'}>
          Dołącz do gry
        </button>
        <button onClick={() => {
          soundManager.play('menu');
          setShowSoundSettings(true);
        }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          Ustawienia
        </button>
        {message && <div className="message">{message}</div>}
      </div>
    </div>
  );

  const renderWaiting = () => (
    <div className="waiting-container">
      <h2>Oczekiwanie na przeciwnika...</h2>
      <div className="spinner"></div>
      <p>{message}</p>
      <button onClick={resetGame}>Anuluj</button>
    </div>
  );

  const renderGame = () => (
    <div className="game-container">
      <div className="game-header">
        <h2 className="'headerAnimation">Code Battle - vs {opponent}</h2>
        <div className="task-info">
          <h3>{task?.title}</h3>
          <p>{task?.description}</p>
          {task?.test_cases && (
            <div className="test-cases">
              <h4>Przykładowe testy:</h4>
              {task.test_cases.slice(0, 2).map((test, i) => (
                <div key={i} className="test-case">
                  Input: {test.input.join(', ')} → Output: {test.expected}
                </div>
              ))}
            </div>
          )}
        </div>
        {message && <div className="game-message">{message}</div>}
      </div>
      
      <div className="editors-container">
        <div className="editor-section">
          <div className="editor-header">
            <h4 style={{color: "#d600cb"}}>Twój kod</h4>
            
          </div>
          <div className="editor-wrapper left">
            <Editor
              height="95%"
              width="70vw"
              defaultLanguage="c"
              value={myCode}
              onChange={updateCode}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                automaticLayout: true
              }}
            />
            <button onClick={submitSolution} className="submit-btn">
              Sprawdź rozwiązanie
            </button>
          </div>
        </div>
        
        <div className="editor-section">
          <div className="editor-header">
            <h4 style={{color: "#28a745"}}>Kod przeciwnika</h4>
          </div>
          <div className="editor-wrapper right">
            <Editor
              height="95%"
              width="20vw"
              defaultLanguage="c"
              value={opponentCode}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                automaticLayout: true
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderFinished = () => (
    <div className="finished-container">
      <div className={`result-card ${gameResult}`}>
        <h2>{gameResult === 'win' ? '🎉 Zwycięstwo!' : '😔 Porażka'}</h2>
        <p>{message}</p>
        <button onClick={resetGame} className="play-again-btn">
          Zagraj ponownie
        </button>
      </div>
    </div>
  );

  return (
    <div className="App">
      {gameState === 'menu' && renderMenu()}
      {gameState === 'waiting' && renderWaiting()}
      {gameState === 'playing' && renderGame()}
      {gameState === 'finished' && renderFinished()}
       
      {/* Sound Settings Modal */}
      {showSoundSettings && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ 
            background: 'black', 
            border: '3px solid #77004d',
            color: '#d600cb',
            padding: '30px', 
            borderRadius: '12px',
            minWidth: '400px',
            fontFamily: '"Press Start 2P", system-ui'
          }}>
          <h3 style={{ marginBottom: '20px', textAlign: 'center', color: '#d600cb' }}>Sound Settings</h3>

          {/* Master Volume */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label>Master</label>
              <button onClick={() => soundManager.play('select')} style={{ /*placeholder*/ }}>Test</button>
            </div>
            <input 
              type="range" min="0" max="100" 
              value={volumeValues.master}
              onChange={(e) => {
                const newValue = parseInt(e.target.value);
                setVolumeValues(prev => ({ ...prev, master: newValue }));
                soundManager.setVolume('master', newValue / 100);
              }}
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '10px', color: '#77004d' }}>{volumeValues.master}%</span>
          </div>

          {/* Effects Volume */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label>Effects</label>
              <button onClick={() => soundManager.play('win')} style={{ /*placeholder*/ }}>Test</button>
            </div>
            <input 
              type="range" min="0" max="100" 
              value={volumeValues.effects}
              onChange={(e) => {
                const newValue = parseInt(e.target.value);
                setVolumeValues(prev => ({ ...prev, effects: newValue }));
                soundManager.setVolume('effects', newValue / 100);
              }}
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '10px', color: '#77004d' }}>{volumeValues.effects}%</span>
          </div>

          {/* Music Volume */}
          <div style={{ marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label>Music</label>
              <button onClick={() => {
                soundManager.play('gamemusic');
                setTimeout(() => soundManager.stop('gamemusic'), 5000);
              }} style={{ /*placeholder*/ }}>Test</button>
            </div>
            <input 
              type="range" min="0" max="100" 
              value={volumeValues.music}
              onChange={(e) => {
                const newValue = parseInt(e.target.value);
                setVolumeValues(prev => ({ ...prev, music: newValue }));
                soundManager.setVolume('music', newValue / 100);
              }}
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '10px', color: '#77004d' }}>{volumeValues.music}%</span>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}

export default App;