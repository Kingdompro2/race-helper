RACE HELPER
===========

Types typing-race passages for you with human-like timing.

FIRST TIME (one-time setup):
  1. Extract this whole folder somewhere (e.g. Desktop).
  2. Double-click install.bat. Approve any admin prompts.
     (If it asks you to reopen after installing Node, do so and run it again.)
  3. Wait for "Setup complete!"

TO PLAY:
  1. Double-click launch.bat.
  2. A fresh Chrome window opens on nitrotype.com.
     First time only: log in.
  3. Click Race. The bot auto-types the race and fires nitros.
  4. Ctrl+C in the terminal window to stop.

TUNING (open bot.mjs in Notepad, edit the CFG block at the top):
  - wpmRange:      [68, 92]     -> higher = faster wins, more suspicious
  - accuracy:      0.945        -> 1.0 = never a typo (looks bot-y)
  - skipRaceChance:0.08         -> 8% of races bot sits out (looks human)
  - nitroChance:   0.75         -> per-nitro odds of firing (leftover nitros save)
  - betweenRaces:  [12000,45000]-> ms to idle between races
  - useNitros:     true         -> set false to disable nitros entirely

BAN RISK:
  Defaults are legit-mode: podium sometimes, don't always win, mixes in AFKs.
  Grinding races back-to-back with wpmRange raised to 100+ gets accounts flagged
  in wave-bans (monthly). Casual use with defaults can last months.

CAPTCHA:
  If Nitro shows a captcha, solve it manually in the Chrome window.
  The bot pauses on its own and resumes when the next race loads.

TROUBLESHOOTING:
  - "Could not find chrome.exe": install Chrome from google.com/chrome, retry.
  - Node not recognized: close & reopen the launcher after install.bat.
  - Wrong text typed / missed chars: raise keyDownUpMs in CFG to [15, 30].
  - Nitros not firing: Nitro Type may have renamed the button class.
    Open DevTools (F12) during a race, inspect the nitro button, and
    add its class to the sels[] list in bot.mjs -> fireNitro().

DO NOT SHARE YOUR LOGIN. The bot uses its own separate Chrome profile
stored at %USERPROFILE%\nitrotype-bot-chrome so it doesn't touch your
main Chrome data.
