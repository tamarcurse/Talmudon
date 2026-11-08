GitHub rejects files over 100MB, so the installer is split into parts.
Join them in Command Prompt (cmd), inside this folder:

  copy /b Talmudon-Setup-0.1.0.zip.001 + Talmudon-Setup-0.1.0.zip.002 Talmudon-Setup-0.1.0.zip

Then unzip it and run Talmudon-Setup-0.1.0.exe.

Alternative (txt copy of the exe, to bypass extension blocking):

  copy /b Talmudon-Setup-0.1.0.txt.001 + Talmudon-Setup-0.1.0.txt.002 Talmudon-Setup-0.1.0.exe
