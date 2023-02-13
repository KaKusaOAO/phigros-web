(_ => {
    if(!_.dat) return;
    if(_.hasSetupDebugger) return;
    _.hasSetupDebugger = true;
    
    var gui = new dat.GUI();
    var currentGame = Phigros.currentGame;

    var Helper = {
        toHiRes() {
            currentGame.setResolutionScale(devicePixelRatio);
        },
        toOverRes() {
            currentGame.setResolutionScale(devicePixelRatio * 2);
        },
        toLowRes() {
            currentGame.setResolutionScale(1);
        },
        toAfricaRes() {
            currentGame.setResolutionScale(devicePixelRatio * 0.5);
        },
        to2X_AfricaRes() {
            currentGame.setResolutionScale(devicePixelRatio * 0.25);
        },

        daycore() {
            currentGame.setPlaybackRate(1 / 1.15);
        },
        nightcore() {
            currentGame.setPlaybackRate(1.15);
        },
        
        spawnJudge() {
            var cw = currentGame.canvas.width;
            var ch = currentGame.canvas.height;

            currentGame.animatedObjects.push(
                new JudgeEffect(currentGame, cw / 2, ch / 2, 10)
            );
        },

        resetAudioOffset() {
            currentGame.audioOffset = 0;
        },

        safariDefaultAudioOffset() {
            currentGame.audioOffset = 310;
        }
    };

    var helper = gui.addFolder("Helper");
    helper.add(currentGame, "useUniqueSpeed").listen();
    helper.add(currentGame, "renderDebug").listen();

    var fx = gui.addFolder("FX");
    fx.add(currentGame, "enableClickSound").listen();
    fx.add(currentGame, "enableParticles").listen();
    fx.add(currentGame, "enableDummyNotes").listen();

    var audio = gui.addFolder("音訊設定");
    audio.add(currentGame, "audioOffset").min(-1000).max(1000).listen();
    audio.add(Helper, "safariDefaultAudioOffset");
    audio.add(Helper, "resetAudioOffset");

    var appearance = gui.addFolder("外觀設定");
    appearance.add(currentGame, "useAnimationFrame").listen();
    appearance.add(currentGame, "backgroundBlur").min(0).max(20).listen();
    appearance.add(currentGame, "backgroundDim").min(0).max(1).listen();
    appearance.add(currentGame, "maxFps").min(1).max(300).listen();
    appearance.add(currentGame, "maxRatio").min(0.5).max(16 / 9).listen();
    appearance.add(currentGame, "smooth").min(1).listen();
    appearance.add(currentGame, "offScreenForceRender").listen();
    appearance.add(currentGame, "songName").listen();
    appearance.add(currentGame, "diffName").listen();
    appearance.add(currentGame, "diffLevel").min(-1).max(20).step(1).listen();
    appearance.add(Helper, "toOverRes");
    appearance.add(Helper, "toHiRes").name("原生畫質模式");
    appearance.add(Helper, "toLowRes").name("一般畫質模式");
    appearance.add(Helper, "toAfricaRes");
    appearance.add(Helper, "to2X_AfricaRes");

    var exclusive = gui.addFolder("進階彩蛋");
    exclusive.add(Helper, "spawnJudge");
    exclusive.add(Helper, "daycore");
    exclusive.add(Helper, "nightcore");
})(window);
