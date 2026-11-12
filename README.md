# Codewords

Play it live: [https://codewords-897n.netlify.app](https://codewords-897n.netlify.app)

A multiplayer social deduction word game for two teams. One Spymaster on each team can see the key. Operatives only see a word until someone reveals the card.

This is an unofficial, open-source game inspired by the tabletop game Codenames. It does not include the commercial word list, artwork, or trademarks. The dictionary in `server/words.js` is original.

## How a turn works

1. The starting team has 9 agents. The other team has 8. The board also has 7 bystanders and 1 assassin.
2. The active Spymaster gives one word and a number from 0 to 9, or Unlimited. `0` and Unlimited both mean no guess cap. Any other number allows that many guesses plus one.
3. Operatives mark cards to suggest them, then reveal a card with the check button.
4. Your own agent keeps the turn going. The other team's agent, a bystander, or an empty guess allowance ends the turn. The assassin ends the game for the other team.
5. When a team finds all of its agents, that team wins. The host can deal a new board.

The server is authoritative. Operative clients never receive unrevealed card identities. The key is sent to Spymasters, and to everyone after the game ends.

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5174](http://127.0.0.1:5174). The client proxies Socket.IO to the server on port 3011. Set `PORT` if 3011 is already in use, and point the Vite proxy at the same port.

The Vite dev server prints a network URL when you want to open the client from another device. The game server stays on this machine and is reached through the client proxy.

```bash
npm test
npm run build
npm start
```

`npm start` serves the built client from the same process as the game server when `client/dist` exists.

## Layout

- `server/` — Express, Socket.IO, and the in-memory `RoomManager`
- `client/` — React, Vite, and Tailwind
- `server/words.js` — 400+ original words

Rooms live in memory when you run the server locally. Restarting the server clears them. Empty rooms are removed after 30 minutes.

The live site runs the same rules through a Netlify Function and stores rooms in Netlify Blobs, because a free Netlify project cannot keep a Socket.IO process running. Local `npm run dev` still uses Socket.IO.

## License

MIT. See [LICENSE](LICENSE).
