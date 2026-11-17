# Discord Quest Completer

A simple script to automatically complete active Discord Quests directly through the Discord developer console.

> **Disclaimer:** Use at your own risk. This project is intended for educational purposes only and is not affiliated with Discord.

---

## Instructions

### Step 1: Accept Quests

Open Discord, navigate to **Quests**, and accept the quests you want to complete.

### Step 2: Enable Developer Tools (Desktop App Only)

_If you are using Discord in a web browser, proceed directly to Step 3._

If you are using the Discord desktop app:

1. Close Discord completely.
2. Press `Win + R`, enter `%appdata%/discord/settings.json`, and press **Enter** (then open the file with a text editor).
3. Add the following line to the file (make sure the JSON format remains valid):

```json
"DANGEROUS_ENABLE_DEVTOOLS_ONLY_ENABLE_IF_YOU_KNOW_WHAT_YOURE_DOING": true
```

4. Save the file and restart Discord.

### Step 3: Open the Console

1. In Discord, press `Ctrl + Shift + I` (or `Cmd + Option + I` on macOS) to open the Developer Tools.
2. Click on the **Console** tab.

### Step 4: Run the Script

1. Copy the entire code from `Discord-Quest-Completer-Script.js`.
2. Paste it into the console and press **Enter**.

- _Note: If Discord blocks pasting, type `allow pasting` into the console, press Enter, and paste the code again._

### Step 5: Wait for Completion

The script will detect and process all accepted quests one by one:

- **Video and Orb Quests:** Progress updates automatically. Keep Discord open until the progress bar reaches 100%.
- **Game Quests:** The script simulates running the required game. Keep Discord open until the timer completes (requires the desktop app).
- **Streaming Quests:** Join any voice channel together with another user or a bot, and stream any window or application; the script handles the rest (requires the desktop app).
- **Activity Quests:** The script automatically simulates activity sessions in the background.

### Step 6: Claim Rewards

Once a quest shows 100% progress in the console, navigate to **Quests** and click on each quest individually to claim your reward.
