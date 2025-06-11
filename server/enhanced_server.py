import asyncio
import websockets
import json
import subprocess
import tempfile
import os
import uuid
import random
from typing import Dict, List, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TaskDatabase:
    """Baza zadań programistycznych"""
    
    TASKS = [
        {
            'title': 'Suma dwóch liczb',
            'description': 'Napisz funkcję int suma(int a, int b) która zwraca sumę dwóch liczb.',
            'function_name': 'suma',
            'test_cases': [
                {'input': [2, 3], 'expected': 5},
                {'input': [10, 15], 'expected': 25},
                {'input': [-5, 8], 'expected': 3},
                {'input': [0, 0], 'expected': 0}
            ]
        },
        {
            'title': 'Największa z trzech liczb',
            'description': 'Napisz funkcję int max_z_trzech(int a, int b, int c) która zwraca największą z trzech liczb.',
            'function_name': 'max_z_trzech',
            'test_cases': [
                {'input': [1, 2, 3], 'expected': 3},
                {'input': [5, 2, 1], 'expected': 5},
                {'input': [2, 8, 4], 'expected': 8},
                {'input': [-1, -2, -3], 'expected': -1},
                {'input': [10, 10, 5], 'expected': 10}
            ]
        },
        {
            'title': 'Silnia',
            'description': 'Napisz funkcję int silnia(int n) która zwraca silnię liczby n (n!).',
            'function_name': 'silnia',
            'test_cases': [
                {'input': [0], 'expected': 1},
                {'input': [1], 'expected': 1},
                {'input': [3], 'expected': 6},
                {'input': [5], 'expected': 120},
                {'input': [7], 'expected': 5040}
            ]
        },
        {
            'title': 'Sprawdzenie liczby pierwszej',
            'description': 'Napisz funkcję int czy_pierwsza(int n) która zwraca 1 jeśli n jest liczbą pierwszą, 0 w przeciwnym przypadku.',
            'function_name': 'czy_pierwsza',
            'test_cases': [
                {'input': [2], 'expected': 1},
                {'input': [3], 'expected': 1},
                {'input': [4], 'expected': 0},
                {'input': [7], 'expected': 1},
                {'input': [9], 'expected': 0},
                {'input': [17], 'expected': 1}
            ]
        },
        {
            'title': 'Fibonacci',
            'description': 'Napisz funkcję int fibonacci(int n) która zwraca n-ty element ciągu Fibonacciego (zaczynając od 0).',
            'function_name': 'fibonacci',
            'test_cases': [
                {'input': [0], 'expected': 0},
                {'input': [1], 'expected': 1},
                {'input': [2], 'expected': 1},
                {'input': [5], 'expected': 5},
                {'input': [8], 'expected': 21}
            ]
        },
        {
            'title': 'Suma cyfr',
            'description': 'Napisz funkcję int suma_cyfr(int n) która zwraca sumę cyfr liczby n.',
            'function_name': 'suma_cyfr',
            'test_cases': [
                {'input': [123], 'expected': 6},
                {'input': [456], 'expected': 15},
                {'input': [7], 'expected': 7},
                {'input': [1000], 'expected': 1},
                {'input': [9876], 'expected': 30}
            ]
        }
    ]
    
    @classmethod
    def get_random_task(cls):
        return random.choice(cls.TASKS).copy()

class GameRoom:
    def __init__(self, room_id: str):
        self.room_id = room_id
        self.players: List[Dict] = []
        self.game_started = False
        self.current_task = None
        self.winner = None
        self.start_time = None
        
    def add_player(self, websocket, player_id: str, nickname: str):
        if len(self.players) >= 2:
            return False
        
        player = {
            'websocket': websocket,
            'player_id': player_id,
            'nickname': nickname,
            'code': '',
            'solved': False,
            'attempts': 0
        }
        self.players.append(player)
        return True
    
    def remove_player(self, player_id: str):
        self.players = [p for p in self.players if p['player_id'] != player_id]
    
    def get_opponent(self, player_id: str):
        for player in self.players:
            if player['player_id'] != player_id:
                return player
        return None
    
    def get_player(self, player_id: str):
        for player in self.players:
            if player['player_id'] == player_id:
                return player
        return None
    
    def update_player_code(self, player_id: str, code: str):
        player = self.get_player(player_id)
        if player:
            player['code'] = code
            return True
        return False
    
    def increment_attempts(self, player_id: str):
        player = self.get_player(player_id)
        if player:
            player['attempts'] += 1
    
    def is_full(self):
        return len(self.players) == 2
    
    def start_game(self):
        self.game_started = True
        self.current_task = TaskDatabase.get_random_task()
        self.start_time = asyncio.get_event_loop().time()

class CodeBattleServer:
    def __init__(self):
        self.rooms: Dict[str, GameRoom] = {}
        self.waiting_players: List[Dict] = []
        self.connected_clients: Dict = {}
        
    async def register_client(self, websocket, path):
        client_id = str(uuid.uuid4())
        self.connected_clients[client_id] = websocket
        logger.info(f"Nowy klient połączony: {client_id}")
        
        try:
            await self.handle_client(websocket, client_id)
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Klient rozłączony: {client_id}")
        except Exception as e:
            logger.error(f"Błąd klienta {client_id}: {e}")
        finally:
            if client_id in self.connected_clients:
                del self.connected_clients[client_id]
            await self.remove_from_waiting(client_id)
            await self.handle_player_disconnect(client_id)
    
    async def handle_client(self, websocket, client_id):
        async for message in websocket:
            try:
                data = json.loads(message)
                await self.handle_message(websocket, client_id, data)
            except json.JSONDecodeError:
                await self.send_error(websocket, "Nieprawidłowy format wiadomości")
            except Exception as e:
                logger.error(f"Błąd podczas obsługi wiadomości: {e}")
                await self.send_error(websocket, "Błąd serwera")
    
    async def handle_message(self, websocket, client_id, data):
        message_type = data.get('type')
        
        if message_type == 'join_queue':
            await self.join_queue(websocket, client_id, data.get('nickname', 'Gracz'))
        elif message_type == 'code_update':
            await self.update_code(client_id, data.get('code', ''))
        elif message_type == 'submit_solution':
            await self.check_solution(client_id, data.get('code', ''))
        elif message_type == 'ping':
            await self.send_message(websocket, {'type': 'pong'})
        else:
            await self.send_error(websocket, "Nieznany typ wiadomości")
    
    async def join_queue(self, websocket, client_id, nickname):
        # Sprawdź czy gracz już nie jest w kolejce
        if any(p['client_id'] == client_id for p in self.waiting_players):
            return
            
        # Sprawdź czy można od razu sparować z oczekującym graczem
        if self.waiting_players:
            waiting_player = self.waiting_players.pop(0)
            await self.create_game(waiting_player, {'websocket': websocket, 'client_id': client_id, 'nickname': nickname})
        else:
            self.waiting_players.append({'websocket': websocket, 'client_id': client_id, 'nickname': nickname})
            await self.send_message(websocket, {
                'type': 'queue_joined',
                'message': f'Oczekiwanie na przeciwnika... (Graczy w kolejce: {len(self.waiting_players)})'
            })
    
    async def create_game(self, player1, player2):
        room_id = str(uuid.uuid4())
        room = GameRoom(room_id)
        
        room.add_player(player1['websocket'], player1['client_id'], player1['nickname'])
        room.add_player(player2['websocket'], player2['client_id'], player2['nickname'])
        
        self.rooms[room_id] = room
        room.start_game()
        
        logger.info(f"Nowa gra utworzona: {room_id} - {player1['nickname']} vs {player2['nickname']}")
        
        # Powiadom obu graczy o rozpoczęciu gry
        for player in room.players:
            opponent = room.get_opponent(player['player_id'])
            await self.send_message(player['websocket'], {
                'type': 'game_started',
                'room_id': room_id,
                'task': room.current_task,
                'opponent': opponent['nickname'] if opponent else 'Nieznany'
            })
    
    async def update_code(self, client_id, code):
        room = self.find_player_room(client_id)
        if room and room.game_started and not room.winner:
            room.update_player_code(client_id, code)
            opponent = room.get_opponent(client_id)
            if opponent:
                await self.send_message(opponent['websocket'], {
                    'type': 'opponent_code_update',
                    'code': code
                })
    
    async def check_solution(self, client_id, code):
        room = self.find_player_room(client_id)
        if not room or room.winner or not room.game_started:
            return
        
        room.increment_attempts(client_id)
        player = room.get_player(client_id)
        
        # Informuj o rozpoczęciu sprawdzania
        await self.send_message(player['websocket'], {
            'type': 'checking_solution',
            'message': f'Sprawdzanie rozwiązania... (próba {player["attempts"]})'
        })
        
        is_correct, error_msg = await self.test_c_code(code, room.current_task)
        
        if is_correct:
            room.winner = client_id
            game_duration = asyncio.get_event_loop().time() - room.start_time
            
            logger.info(f"Gra zakończona w pokoju {room.room_id}. Zwycięzca: {player['nickname']} w {game_duration:.1f}s")
            
            # Powiadom zwycięzcę
            await self.send_message(player['websocket'], {
                'type': 'game_result',
                'result': 'win',
                'message': f'Gratulacje! Wygrałeś w {game_duration:.1f} sekund!',
                'attempts': player['attempts'],
                'duration': game_duration
            })
            
            # Powiadom przegranego
            opponent = room.get_opponent(client_id)
            if opponent:
                await self.send_message(opponent['websocket'], {
                    'type': 'game_result',
                    'result': 'lose',
                    'message': f'Przegrałeś. {player["nickname"]} rozwiązał zadanie w {game_duration:.1f} sekund.',
                    'attempts': opponent['attempts'],
                    'duration': game_duration
                })
        else:
            # Powiadom o niepoprawnym rozwiązaniu
            await self.send_message(player['websocket'], {
                'type': 'solution_incorrect',
                'message': f'Rozwiązanie niepoprawne (próba {player["attempts"]}). {error_msg}',
                'attempts': player['attempts']
            })
    
    async def test_c_code(self, code: str, task: dict) -> tuple[bool, str]:
        """Testuje kod C poprzez kompilację i uruchomienie"""
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                # Stwórz plik z kodem użytkownika
                code_file = os.path.join(temp_dir, 'solution.c')
                
                # Dodaj nagłówki i funkcję main do testowania
                full_code = f"""
#include <stdio.h>
#include <stdlib.h>

{code}

int main() {{
    // Test cases
"""
                
                # Dodaj test cases
                for i, test_case in enumerate(task['test_cases']):
                    inputs = test_case['input']
                    expected = test_case['expected']
                    full_code += f"""
    int result{i} = {task['function_name']}({', '.join(map(str, inputs))});
    if (result{i} != {expected}) {{
        printf("Test {i+1} nie przeszedł: oczekiwano {expected}, otrzymano %d\\n", result{i});
        return 1;
    }}
"""
                
                full_code += """
    printf("Wszystkie testy przeszły!\\n");
    return 0;
}
"""
                
                with open(code_file, 'w') as f:
                    f.write(full_code)
                
                # Kompiluj kod
                executable = os.path.join(temp_dir, 'solution')
                compile_result = subprocess.run(
                    ['gcc', '-o', executable, code_file, '-Wall'],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                
                if compile_result.returncode != 0:
                    error_msg = "Błąd kompilacji: " + compile_result.stderr[:200]
                    logger.info(f"Compilation failed: {compile_result.stderr}")
                    return False, error_msg
                
                # Uruchom program
                run_result = subprocess.run(
                    [executable],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                
                if run_result.returncode == 0:
                    return True, "Wszystkie testy przeszły!"
                else:
                    error_msg = run_result.stdout[:200] if run_result.stdout else "Program zwrócił błąd"
                    return False, error_msg
                
        except subprocess.TimeoutExpired:
            return False, "Przekroczono limit czasu wykonania"
        except Exception as e:
            logger.error(f"Error testing code: {e}")
            return False, f"Błąd serwera: {str(e)[:100]}"
    
    async def handle_player_disconnect(self, client_id: str):
        """Obsługuje rozłączenie gracza"""
        room = self.find_player_room(client_id)
        if room:
            # Powiadom przeciwnika o rozłączeniu
            opponent = room.get_opponent(client_id)
            if opponent:
                await self.send_message(opponent['websocket'], {
                    'type': 'opponent_disconnected',
                    'message': 'Przeciwnik się rozłączył. Wygrywasz przez walkower!'
                })
            
            # Usuń pokój
            if room.room_id in self.rooms:
                del self.rooms[room.room_id]
                logger.info(f"Pokój {room.room_id} został usunięty z powodu rozłączenia")
    
    def find_player_room(self, client_id: str) -> Optional[GameRoom]:
        for room in self.rooms.values():
            for player in room.players:
                if player['player_id'] == client_id:
                    return room
        return None
    
    async def remove_from_waiting(self, client_id: str):
        self.waiting_players = [p for p in self.waiting_players if p['client_id'] != client_id]
    
    async def send_message(self, websocket, message):
        try:
            await websocket.send(json.dumps(message))
        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            logger.error(f"Error sending message: {e}")
    
    async def send_error(self, websocket, error_message):
        await self.send_message(websocket, {
            'type': 'error',
            'message': error_message
        })

async def main():
    server = CodeBattleServer()
    logger.info("Uruchamianie Code Battle Server...")
    
    # Nasłuchuj na wszystkich interfejsach (0.0.0.0) zamiast tylko localhost
    # To pozwoli na połączenia z innych komputerów
    host = "0.0.0.0"  # Zmienione z "localhost"
    port = 8765
    
    logger.info(f"Serwer będzie nasłuchiwał na {host}:{port}")
    
    async with websockets.serve(server.register_client, host, port):
        logger.info("Serwer uruchomiony! Oczekiwanie na połączenia...")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Serwer został zatrzymany przez użytkownika")
    except Exception as e:
        logger.error(f"Błąd serwera: {e}")
        raise