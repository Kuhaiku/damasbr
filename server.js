const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let players = { p1: null, p2: null };
let spectators = [];
let currentTurn = 1;
let scores = { p1: 0, p2: 0 };
let gameActive = true;
let moveHistory = [];
let chatMessages = [];

const initialBoard = [
    [0, 2, 0, 2, 0, 2, 0, 2],
    [2, 0, 2, 0, 2, 0, 2, 0],
    [0, 2, 0, 2, 0, 2, 0, 2],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 1, 0, 1, 0, 1, 0],
    [0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 0]
];

let board = JSON.parse(JSON.stringify(initialBoard));

function broadcastState() {
    io.emit('gameState', { players, spectators, board, currentTurn, scores, gameActive, moveHistory, chatMessages });
}

io.on('connection', (socket) => {
    socket.on('join', (name) => {
        const user = { id: socket.id, name };
        if (!players.p1) { players.p1 = user; socket.emit('role', 'p1'); } 
        else if (!players.p2) { players.p2 = user; socket.emit('role', 'p2'); } 
        else { spectators.push(user); socket.emit('role', 'spectator'); }
        
        chatMessages.push({ system: true, text: `${name} entrou na sala.` });
        broadcastState();
    });

    socket.on('makeMove', (data) => {
        if (!gameActive) return;
        board = data.board;
        currentTurn = data.nextTurn;
        
        if (data.notation) {
            moveHistory.push({ player: data.playerName, notation: data.notation });
        }
        
        broadcastState();
    });

    socket.on('swapRoles', () => {
        if (players.p1 || players.p2) {
            const temp = players.p1;
            players.p1 = players.p2;
            players.p2 = temp;
            
            if (players.p1) io.to(players.p1.id).emit('role', 'p1');
            if (players.p2) io.to(players.p2.id).emit('role', 'p2');
            
            board = JSON.parse(JSON.stringify(initialBoard));
            currentTurn = 1;
            scores = { p1: 0, p2: 0 };
            moveHistory = [];
            gameActive = true;
            chatMessages.push({ system: true, text: `As cores foram trocadas e o jogo foi reiniciado.` });
            
            broadcastState();
        }
    });

    socket.on('sendChat', (text) => {
        let senderName = "Espectador";
        if (players.p1 && players.p1.id === socket.id) senderName = players.p1.name;
        if (players.p2 && players.p2.id === socket.id) senderName = players.p2.name;
        
        chatMessages.push({ sender: senderName, text });
        if (chatMessages.length > 50) chatMessages.shift(); // Limita o histórico do chat
        
        io.emit('newChatMessage', { sender: senderName, text });
    });

    socket.on('gameOver', (winnerRole) => {
        if (!gameActive) return;
        gameActive = false;
        
        if (winnerRole === 'p1') scores.p1++;
        if (winnerRole === 'p2') scores.p2++;
        
        const winnerName = winnerRole === 'p1' ? players.p1.name : players.p2.name;
        io.emit('announceWinner', { winnerName, winnerRole, scores });
        broadcastState();
    });

    socket.on('restartGame', () => {
        board = JSON.parse(JSON.stringify(initialBoard));
        currentTurn = 1;
        gameActive = true;
        moveHistory = [];
        chatMessages.push({ system: true, text: `Um novo jogo foi iniciado!` });
        broadcastState();
    });

    socket.on('disconnect', () => {
        let roleChanged = false;
        let leftName = "Alguém";

        if (players.p1 && players.p1.id === socket.id) { leftName = players.p1.name; players.p1 = null; roleChanged = true; } 
        else if (players.p2 && players.p2.id === socket.id) { leftName = players.p2.name; players.p2 = null; roleChanged = true; } 
        else { spectators = spectators.filter(s => s.id !== socket.id); }

        if (roleChanged) {
            chatMessages.push({ system: true, text: `${leftName} saiu da partida. O jogo foi resetado.` });
            if (spectators.length > 0) {
                const next = spectators.shift();
                if (!players.p1) { players.p1 = next; io.to(next.id).emit('role', 'p1'); } 
                else if (!players.p2) { players.p2 = next; io.to(next.id).emit('role', 'p2'); }
            }
            
            board = JSON.parse(JSON.stringify(initialBoard));
            currentTurn = 1;
            scores = { p1: 0, p2: 0 };
            moveHistory = [];
            gameActive = true;
            io.emit('playerLeft');
        }
        broadcastState();
    });
});

server.listen(3000, () => console.log('Servidor rodando em http://localhost:3000'));
