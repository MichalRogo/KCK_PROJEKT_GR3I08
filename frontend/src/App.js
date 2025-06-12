import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import './App.css';
import logo from './logo.png'
// import script from './script'

// ZMIEŃ TEN ADRES NA IP TWOJEJ VM!
const WEBSOCKET_URL = 'wss://f4a5938f4651254eab8a746a8eebe3a8.serveo.net';
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

  const socketRef = useRef(null);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const connectToServer = () => {
    if (!nickname.trim()) {
      setMessage('Podaj swój nick!');
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
        break;
        
      case 'solution_incorrect':
        setMessage(data.message);
        setTimeout(() => setMessage(''), 5000); // Zwiększony czas wyświetlania
        break;
        
      case 'opponent_disconnected':
        setMessage(data.message);
        setGameState('finished');
        setGameResult('win');
        break;
        
      case 'error':
        setMessage(`Błąd: ${data.message}`);
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
        <button >
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
    </div>
  );
}

export default App;