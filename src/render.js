const { desktopCapturer, remote } = require("electron");
const { Menu } = remote;
const dC = desktopCapturer;

const outStream = document.getElementById("outputStream");

let defaultComb = "video/webm; codecs=vp8";

let otherCombs = [
    /*'video/mp4',*/ "video/3gpp", "video/3gp2", "video/webm; codecs=vp8", "video/webm; codecs=vp9", "video/x-msvideo"
];

let selectComb = comb => {
    defaultComb = comb;
    // console.log("MIME & Codecs combination successfully changed!")
    document.getElementById("btnGroupDrop2").innerText = comb;
}

let audioEnabled = false

selectComb(defaultComb);

let videoSourcesAll = async() => {
    let inpSrc = await dC.getSources({
        types: ['window', 'screen'],
    });

    let contextMenu = Menu.buildFromTemplate(
        inpSrc.map(src => {
            return {
                label: `${src.name} [ID ${src.id}]`,
                click: () => selectInpSrc(src)
            }
        })
    );
    
    contextMenu.popup();
}

let mediaRecord;
let mediaChunks = [];

let startBtn = document.getElementById("recordStart");
let stopBtn = document.getElementById("recordStop");
let btnGroupDrop2 = document.getElementById("btnGroupDrop2");
let otherCombsDiv = document.getElementById("divOtherCombs");

document.onclick = (e) => {
    switch(e.target){
        case btnGroupDrop2:
            if (otherCombsDiv.style.display == "none"){
                otherCombsDiv.style.display = "block";
            }else{
                otherCombsDiv.style.display = "none"
            };
            break;
        case startBtn:
            if(typeof mediaRecord == "undefined") {
                const { dialog, BrowserWindow } = remote;
                const _window = BrowserWindow.getFocusedWindow();
                dialog.showMessageBox(_window, {
                title: "Select CRS First!",
                buttons: ["Okay"],
                type: "info",
                message: `Program couldn't detect CRS (Current Recording Source), select one first!`,
                });
                delete dialog;
            } else {
                mediaRecord.start();
                startBtn.style.display = "none";
                stopBtn.style.display = "inline-block";
            }
            break;
        case stopBtn:
            mediaRecord.stop();
            stopBtn.style.display = "none";
            startBtn.style.display = "inline-block";
            break;
        default:
            otherCombsDiv.style.display = "none"
            break;
    }
}

let selectInpSrc = async src => {
    document.getElementById("btnGroupDrop1").innerHTML = `CRS: ${src.name}`;
    const vidConstraints = {
        audio: defaultComb != "video/mp4" ? false : true,
        video: {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: src.id
            }
        }
    }
    const audioConstraints = { audio:audioEnabled }
    const videoStream = await navigator.mediaDevices
        .getUserMedia(vidConstraints);
    const audioStream = audioEnabled ? await navigator.mediaDevices
        .getUserMedia(audioConstraints) : new MediaStream();
    outStream.srcObject = videoStream;
    outStream.play();

    const fullStream = new MediaStream([...videoStream.getVideoTracks(), ...audioStream.getAudioTracks()]);
    const opts = { mimeType: defaultComb };
    mediaRecord = new MediaRecorder(fullStream, opts);

    mediaRecord.ondataavailable = handleAvailableData;
    mediaRecord.onstop = handleStop;
}

let handleAvailableData = prm => {
    mediaChunks.push(prm.data);
}

let rcFilter;

let handleStop = async() => {
    const { BrowserWindow, dialog } = remote;
    const { writeFile } = require("fs");
    const blob = new Blob(mediaChunks, { type: defaultComb });
    const bf = Buffer.from(await blob.arrayBuffer());
    switch(defaultComb){
        /*case 'video/mp4':
            rcFilter = { name: "Video on the MP4 format without codecs [Recommended, Widely Supported]", extensions: ["mp4"] };
            break;*/
        case "video/3gpp":
            rcFilter = { name: "Video on the 3GPP format without codecs", extensions: ["3gpp"] };
            break;
        case "video/3gp2":
            rcFilter = { name: "Video on the 3GP2 format without codecs", extensions: ["3gp2"] };
            break;
        case "video/webm; codecs=vp8":
            rcFilter = { name: "Web Media File with VP8 codec [Recommended for Web, Fully Supported in the Recorder]", extensions: ["webm"] };
            break;
        case "video/webm; codecs=vp9":
            rcFilter = { name: "Web Media File with VP9 codec [Recommended for Web, Fully Supported in the Recorder]", extensions: ["webm"] };
            break;
        case "video/x-msvideo":
            rcFilter = { name: "Audio Video Interleave [Recommended, Widely Supported]", extensions: ["avi"] };
            break;
    }
    const { filePath } = await dialog.showSaveDialog({
        title: "Video save dialog",
        buttonLabel: "Save the Video (which is just got recorded)",
        defaultPath: `SRVid-${Date.now()}`,
        filters :[
            rcFilter,
            {name: 'All Files', extensions: ['*']}
        ]
    });
    const _window = BrowserWindow.getFocusedWindow();
    writeFile(filePath, bf, () => { 
        if (filePath.trim() != ""){
            dialog.showMessageBox(_window, {
                title: "Video Saved Successfully!",
                buttons: ["Okay"],
                type: "info",
                message: `Your video saved successfully at the ${filePath}!`
            });
        } else { 
            dialog.showMessageBox(_window, {
                title: "Video Save Cancelled!",
                buttons: ["Okay?"],
                type: "warning",
                message: `Video-save got cancelled or some troubleshooting happened!`
            });
        }
    });
    delete BrowserWindow, dialog, writeFile, blob, bf, filePath, _window;
}


let buildAppMenu = () => {
    const { dialog, BrowserWindow, shell } = remote;
    const _window = BrowserWindow.getFocusedWindow();
    const template = [
        {
            label: "Main",
            submenu: [
                {
                    role: 'reload'
                },
                /*
                {
                    role: 'zoomin'
                },
                {
                    role: 'zoomout'
                },
                {
                    role: "tooglefullscreen"
                },
                */
                {
                    role: 'toggledevtools'
                },
                {
                    role: "minimize"
                },
                {
                    role: "close"
                }
            ]
        },
        {
            label: "Functions",
            submenu: [
                {
                    label: "Select an input source as CRS",
                    click: () => videoSourcesAll(),
                    accelerator: "F5"
                },
                {
                    label: "Select MIME & Codec",
                    click: () => combsToMenu(),
                    accelerator: "F6"
                },
                {
                    label: "Start Recording",
                    click: () => {
                        if(typeof mediaRecord == "undefined") {
                            const _window = BrowserWindow.getFocusedWindow();
                            dialog.showMessageBox(_window, {
                                title: "Select CRS First!",
                                buttons: ["Okay"],
                                type: "info",
                                message: `Program couldn't detect CRS (Current Recording Source), select one first!`,
                            });
                        } else {
                            mediaRecord.start();
                            startBtn.style.display = "none";
                            stopBtn.style.display = "inline-block";
                        }
                    },
                    accelerator: "F7"
                },
                {
                    label: "Stop Recording",
                    click: () => {
                        if(mediaRecord.state == "recording") {
                            mediaRecord.stop();
                            stopBtn.style.display = "none";
                            startBtn.style.display = "inline-block";
                        }
                    },
                    accelerator: "F8"
                },
                {
                    type:"checkbox",
                    label:"Audio Input",
                    click:() => {
                        audioEnabled = this.checked;
                    },
                    accelerator: "F9"
                },
            ]
        },
        {
            label: "About",
            submenu: [
                {
                    label: "About the Developer...",
                    click: () => {
                        dialog.showMessageBox(_window, {
                            title: "About the Developer...",
                            buttons: ["Got it."],
                            type: "info",
                            message: `The developer of that amateur screen recorder is called Masharibov Azizbek. Azizbek is 15 years old and so interested in programming. He is currently working on personal projects and learning game development. If you wanna reach him out, his telegram user is @developer_from_future and twitter user is @zazodev (but he uses twitter very rarely, sorry)`,
                        });
                    }
                },
                {
                    label: "About the 2nd Developer & UI Designer...",
                    click: () => {
                        dialog.showMessageBox(_window, {
                            title: "About the UI Designer & Second developer...",
                            buttons: ["Okay."],
                            type: "info",
                            message: `Talented developer who designed UI and helped while improving the app, is called Viktor. Check put his github account, he has some nice projects: https://github.com/KR1470R`,
                        });
                    }
                },
                {
                    label: "About the program...",
                    click: () => {
                        dialog.showMessageBox(_window, {
                            title: "About the Program...",
                            buttons: ["Mhm."],
                            type: "info",
                            message: `This programm called "ScreenRekt" is developer in 24 hours (I don't even know the exact time actually), and used for recording screens and/or only windows, with or without audio. This programm is powered by ElectronJS, which uses Chromium as backbone, and totally written in JavaScript, HTML and CSS (it explains why program got crappy UI, sorry for that.)`,
                        });
                    }
                },
                {
                    label: "About the next update...",
                    click: () => {
                        dialog.showMessageBox(_window, {
                            title: "About the next update",
                            buttons: ["That's nice!"],
                            type: "info",
                            message: `In next update, UI will be improved and some features such as PAUSING and HIDING TO THE TRAY will be added. And some codec bugs which is happening with video/mp4 mime-type will be fixed. And maybe light/dark mode switch, who knows :)`,
                        });
                    }
                },
                {
                    label: "Open the GitHub repository of this program",
                    click: () => {
                        dialog.showMessageBox(_window, {
                            title: "From developers",
                            buttons: ["Okay, I will!", "Nah mate."],
                            type: "info",
                            message: `Btw, if you wanna use the code, please, don't forget to credit us ;) And for learning purposes, feel free to edit and customize the project! Don't forget to star and watch the project (Please)!`
                        });
                        shell.openExternal("https://github.com/AzizbekTheDev/ScreenRekt");
                    }
                },
                {
                    label: "Tutorials that helps to create that kind of programs...",
                    submenu: [
                        {
                            label: "Learn JS concepts in one video",
                            click: () => {
                                shell.openExternal("https://www.youtube.com/watch?v=W6NZfCO5SIk");
                            }
                        },
                        {
                            label: "Mozilla Docs (for JS)",
                            click: () => {
                                shell.openExternal("https://developer.mozilla.org/en-US/docs/Web/JavaScript")
                            }
                        },
                        {
                            label: "Electron Docs",
                            click: () => {
                                shell.openExternal("https://www.electronjs.org/docs")
                            }
                        },
                        {
                            label: "Building an Electron App in 10 minutes...",
                            click: () => {
                                shell.openExternal("https://www.youtube.com/watch?v=3yqDxhR2XxE")
                            }
                        }
                    ]
                }
            ]
        }
    ]
    let menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    delete dialog, BrowserWindow, menu;
}


buildAppMenu();
