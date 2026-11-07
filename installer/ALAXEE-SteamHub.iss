#define AppName "ALAXEE SteamHub"
#define AppVersion "0.1.0"
#define AppPublisher "ALAXEE"

[Setup]
AppId={{A4C5DAD5-0D5A-4C96-8EF6-7D23C776A3D1}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\Programs\ALAXEE\SteamHub
DefaultGroupName=ALAXEE SteamHub
UninstallDisplayName=ALAXEE SteamHub
UninstallDisplayIcon={app}\AlaxeeSteamBridge.exe
PrivilegesRequired=lowest
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
DisableProgramGroupPage=yes
UsePreviousAppDir=yes
Uninstallable=yes
CloseApplications=yes
CloseApplicationsFilter=AlaxeeSteamBridge.exe
RestartApplications=no
OutputDir=..\dist
OutputBaseFilename=ALAXEE-SteamHub-Setup-x64
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
SetupLogging=yes
VersionInfoCompany=ALAXEE
VersionInfoProductName=ALAXEE SteamHub
VersionInfoProductVersion={#AppVersion}
VersionInfoDescription=ALAXEE SteamHub installer

[Languages]
Name: "chinesesimp"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[CustomMessages]
chinesesimp.RemoveLocalDataPrompt=是否同时删除此设备上的 ALAXEE SteamHub 设置、缓存、日志和临时文件？%n%n选择“是”会彻底清理本地数据；选择“否”会保留本地数据，方便以后重新安装。%n%nSupabase 云端账号和跨设备同步数据不会被删除。
chinesesimp.DesktopIcon=创建桌面快捷方式
chinesesimp.AdditionalIcons=附加快捷方式：

[Tasks]
Name: "desktopicon"; Description: "{cm:DesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Dirs]
Name: "{localappdata}\ALAXEE\SteamHub"; Flags: uninsneveruninstall

[Files]
Source: "..\dist\_windows-package\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\ALAXEE SteamHub"; Filename: "{app}\Start-Steam-Bridge.bat"; WorkingDir: "{app}"; IconFilename: "{app}\AlaxeeSteamBridge.exe"
Name: "{autodesktop}\ALAXEE SteamHub"; Filename: "{app}\Start-Steam-Bridge.bat"; WorkingDir: "{app}"; IconFilename: "{app}\AlaxeeSteamBridge.exe"; Tasks: desktopicon

[Code]
var
  RemoveLocalDataOnUninstall: Boolean;

function InitializeUninstall(): Boolean;
begin
  Result := True;
  if WizardSilent then
  begin
    RemoveLocalDataOnUninstall := True;
    Exit;
  end;

  RemoveLocalDataOnUninstall :=
    MsgBox(ExpandConstant('{cm:RemoveLocalDataPrompt}'),
      mbConfirmation, MB_YESNO or MB_DEFBUTTON1) = IDYES;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  LocalDataPath: String;
begin
  if (CurUninstallStep = usPostUninstall) and RemoveLocalDataOnUninstall then
  begin
    LocalDataPath := ExpandConstant('{localappdata}\ALAXEE\SteamHub');
    if DirExists(LocalDataPath) then
      DelTree(LocalDataPath, True, True, True);
  end;
end;
