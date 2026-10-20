; Inno Setup 安裝程式設定
; 先以 PyInstaller 產生 desktop\dist\PDF Editor\，再於 desktop\ 執行：
;   iscc /DAppVersion=1.0.0 installer.iss

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif

[Setup]
AppId={{6F1D3C2A-8B4E-4F6A-9C1D-2E7B5A9F0C31}
AppName=PDF Editor
AppVersion={#AppVersion}
AppPublisher=PIGGYcloudy
AppPublisherURL=https://github.com/PIGGYcloudy/PDF-editor
DefaultDirName={autopf}\PDF Editor
DefaultGroupName=PDF Editor
DisableProgramGroupPage=yes
; 安裝到使用者自己的程式目錄，不需要系統管理員權限
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=dist
OutputBaseFilename=PDF-Editor-Setup-{#AppVersion}
UninstallDisplayIcon={app}\PDF Editor.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Languages]
; 新版 Inno Setup 內建繁體中文；舊版由 CI 下載到 build\；都沒有時只提供英文
#if FileExists(CompilerPath + "Languages\ChineseTraditional.isl")
Name: "chinesetraditional"; MessagesFile: "compiler:Languages\ChineseTraditional.isl"
#elif FileExists(SourcePath + "build\ChineseTraditional.isl")
Name: "chinesetraditional"; MessagesFile: "build\ChineseTraditional.isl"
#endif
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "dist\PDF Editor\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\PDF Editor"; Filename: "{app}\PDF Editor.exe"
Name: "{group}\{cm:UninstallProgram,PDF Editor}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\PDF Editor"; Filename: "{app}\PDF Editor.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\PDF Editor.exe"; Description: "{cm:LaunchProgram,PDF Editor}"; Flags: nowait postinstall skipifsilent
