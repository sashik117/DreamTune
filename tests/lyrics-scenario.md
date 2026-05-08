# Lyrics Smoke Scenario

1. Start the app with `npm run dev`.
2. Add or open a song that has either `.lrc` synced lyrics or plain lyrics.
3. Open the full player and switch to the `Текст` tab.
4. Click `Знайти текст`.
5. Expected result for synced lyrics: the active line follows `currentTime`, centers while playing, and clicking a line seeks the track.
6. Expected result for long/plain lyrics: text wraps inside the viewport and scrolls vertically without horizontal overflow.
7. Expected result on lookup failure: the UI stays interactive and shows `ШІ замріявся і пише вірші... Спробуйте за мить!`.
