/*******************************************************************************
 * phigros.js -- by Kaka
 * 
 * --- **NOT** fully compatible with Safari! ---
 * 
 * Web Audio API and Canvas API is not fully compatible with Safari.
 * Other Chromium-based WebKit browsers are recommended.
 * 
 * If your are using iOS / iPadOS, you have bad luck here. :(
 * 
 ******************************************************************************/
const $_PhigrosJS = {
    author: "Kaka",
    source: "https://github.com/Kaka/phigros-web"
};

var Assets = {
    preferredFont: `Saira, Exo, "Noto Sans CJK TC", sans-serif`,
    loadImageAsset(name, source) {
        return new Promise((resolve, _) => {
            var img = new Image();
            img.onload = () => {
                this[name] = img;
                resolve();
            };
            img.src = source;
        });
    },
    loadAudioAsset(name, source, game) {
        return new Promise((resolve, _) => {
            /** @type {AudioContext} */
            var ctx = game.audioContext;
            if(!ctx) {
                resolve(null);
                return;
            }

            fetch(source)
                .then(r => r.arrayBuffer())
                .then(buf => {
                    if(window.AudioContext) {
                        return ctx.decodeAudioData(buf);
                    } else {
                        this[name] = ctx.createBuffer(buf, false);
                        resolve();
                    }
                })
                .then(buf => {
                    if(buf) {
                        this[name] = buf;
                        resolve();
                    }
                });
        });
    }
};

var Constants = {
    difficulties: [
        "EZ", "HD", "IN", "AT"
    ]
}

var Serializer = K.Serializer;

/** Chart elements start **/
var NoteTypes = {
    dummy: -1,
    tap: 1,
    catch: 2,
    hold: 3,
    flick: 4
};

/**
 * 
 * @param {ChartEvent[]} events 
 * @param {number} time 
 * @param {number | undefined} start 
 * @param {number | undefined} end 
 * @returns 
 */
let findEvent = (events, time, start, end) => {
    start ??= 0;
    end ??= events.length - 1;

    // Base Condition
    if (start > end) return null;

    let mid = Math.floor((start + end)/2);
    let e = events[mid];
    if (time > e.startTime && time <= e.endTime) return e;

    if (e.startTime >= time) {
        return findEvent(events, time, start, mid - 1);
    } else {
        return findEvent(events, time, mid + 1, end);
    }
};

class Judge {
    constructor() {

    }
}

class AnimatedObject {
    constructor() {
        this.notNeeded = false;
    }

    update() {

    }

    fixedUpdate() {

    }
}

class JudgeEffect extends AnimatedObject {
    constructor(game, x, y, amount) {
        super();
        this.game = game;
        this.x = x / game.canvas.width * game.refScreenWidth;
        this.y = y / game.canvas.height * game.refScreenHeight;
        this.particles = [];
        this.startTime = performance.now();

        for(var i=0; i<amount; i++) {
            var r = Math.random() * Math.PI * 2;
            var force = (Math.random() * 7 + 7);
            this.particles.push({
                spawnTime: this.startTime,
                position: [0, 0],
                motion: [Math.cos(r) * force, Math.sin(r) * force]
            });
        }
    }

    fixedUpdate() {
        // Particles
        this.particles.forEach(p => {
            p.position[0] += p.motion[0];
            p.position[1] += p.motion[1];
            p.motion[0] *= Math.pow(0.92, Math.pow(this.game.audioElem.playbackRate, 0.275));
            p.motion[1] *= Math.pow(0.92, Math.pow(this.game.audioElem.playbackRate, 0.275));
        });
    }

    update() {
        var game = this.game;
        var ctx = game.context;
        var startTime = this.startTime;

        var progress = (performance.now() - startTime) / (500 / game.audioElem.playbackRate);
        var t = ctx.getTransform();

        var size = 100 * game.getNoteRatio();

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.translate(this.x * game.canvas.width / game.refScreenWidth, this.y * game.canvas.height / game.refScreenHeight);
        ctx.strokeStyle = "#fea";
        ctx.fillStyle = "#fea";

        ctx.lineWidth = 4 * game.getNoteRatio();
        ctx.globalAlpha = Math.pow(Math.max(0, 1 - progress), 1.1);
        var s2 = size * (0.75 + 0.25 * (1 - Math.pow(1 - progress, 5)));
        ctx.strokeRect(-s2, -s2, s2 * 2, s2 * 2);
        ctx.rotate(Math.PI / 4);

        var sThick = 48 * Math.pow(Math.max(0, 1 - progress), 2);
        ctx.lineWidth = (sThick * Math.pow(Math.max(0, 1 - progress), 2)) * game.getNoteRatio();
        var s3 = size - sThick * 0.5 * Math.pow(Math.max(0, 1 - progress), 2) * game.getNoteRatio();
        s3 *= (0.8 + 0.3 * Math.pow(progress, 0.25));
        var aa = Math.pow(Math.max(0, 1 - progress), 2);
        ctx.globalAlpha *= 0.125;
        ctx.strokeRect(-s3, -s3, s3 * 2, s3 * 2);
        ctx.rotate(-Math.PI / 4);

        ctx.lineWidth = 6 * game.getNoteRatio();
        ctx.globalAlpha = Math.pow(aa, 0.33);
        var offset = (1 - Math.pow(1 - progress, 3)) * (Math.PI / 4) - Math.PI / 4;
        ctx.beginPath();
        ctx.arc(0, 0, s2 * 0.9, offset, offset - Math.PI / 2, true);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, s2 * 0.9, offset + Math.PI / 2, offset + Math.PI);
        ctx.stroke();
        ctx.globalAlpha = aa;

        ctx.beginPath();
        ctx.arc(0, 0, size * Math.min(0.25, 0.1 / Math.max(0, 1 - Math.pow(1 - progress, 4))), 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha /= 4;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.5 * Math.pow(progress, 0.25), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha *= 4;

        // Particles
        this.particles.forEach(p => {
            var x = p.position[0] * game.getNoteRatio();
            var y = p.position[1] * game.getNoteRatio();
            var size = (Math.pow(progress, 0.25) * 7.5 + 7.5) * game.getNoteRatio();
            ctx.fillRect(-size + x, -size + y, size * 2, size * 2);
        });

        ctx.setTransform(t);

        ctx.lineWidth = 0;
        ctx.globalAlpha = 1;

        if(progress >= 1) {
            this.notNeeded = true;
        }
    }
}

class Note {
    /**
     * @param {number} type 
     */
    constructor(type) {
        this.type = type;
        this.time = 0;
        this.positionX = 0;
        this.speed = 1;
        this.floorPosition = 0;

        // Custom state
        /** @type {JudgeLine} */
        this.parent = null;
        this.noteWidth = 240;
        this.hasSibling = false;
    }

    doesClipOnPositiveSpeed() {
        return false;
    }

    static deserialize(raw) {
        switch(raw.type) {
            case NoteTypes.tap:
                return TapNote.deserialize(raw);
            case NoteTypes.flick:
                return FlickNote.deserialize(raw);
            case NoteTypes.hold:
                return HoldNote.deserialize(raw);
            case NoteTypes.catch:
                return CatchNote.deserialize(raw);
            case NoteTypes.dummy:
                return DummyNote.deserialize(raw);
            default:
                return Serializer.deserialize(raw, Note);
        }
    }

    serialize() {
        var note = Serializer.serialize(this, [
            "type", "time", "positionX", "speed", "floorPosition"
        ]);
        note.holdTime = this.holdTime || 0;

        if(this.noteWidth != 240) {
            note.noteWidth = this.noteWidth;
        }

        return note;
    }

    static _copyValuesToRef(ref, raw) {
        ref.time = raw.time;
        ref.positionX = raw.positionX;
        ref.speed = raw.speed;
        ref.floorPosition = raw.floorPosition;
        if(raw.noteWidth) {
            ref.noteWidth = raw.noteWidth;
        }
    }

    getAudioFX() {
        return Assets.fx;
    }

    spawnJudge(game) {
        if(!game.enableParticles) return;

        var time = this instanceof HoldNote ? game.time : this.parent.getRealTime(this.time);
        var linePos = this.parent.getScaledPosition(game, this.parent.getLinePosition(time));
        var rad = -this.parent.getLineRotation(time) / 180 * Math.PI;
        var xPos = this.getXPos(game);

        var px = Math.cos(rad) * xPos + linePos.x;
        var py = Math.sin(rad) * xPos + linePos.y;

        var j = new JudgeEffect(game, px, py, 4);
        game.animatedObjects.push(j);
    }

    getClearTime() {
        return this.time;
    }

    isOffScreen(game) {
        if (this instanceof HoldNote) {
            var endTime = this.time + this.holdTime;
            var gt = this.parent.getConvertedGameTime(game.time);
            if (gt > this.time && gt <= endTime) return false;
        }
        return Math.abs(this.floorPosition - this.parent.getCurrentFloorPosition()) > 10;
    }

    isDummy() {
        return false;
    }

    isMissed(game) {
        var gt = this.parent.getConvertedGameTime(game.time);
        return gt > this.getClearTime() && !this.cleared;
    }

    getAlpha(game) {
        if (!this.isMissed(game)) return 1;

        var gt = this.parent.getConvertedGameTime(game.time);
        var clearTime = this.getClearTime();
        if (gt < clearTime) return 1;

        var alpha = 0.5;
        var a0time = this.parent.getConvertedGameTime(this.parent.getRealTime(clearTime) + 250);
        var progress = (gt - clearTime) / (a0time - clearTime);
        progress = Math.min(1, Math.max(0, progress));
        alpha *= 1 - progress;
        return alpha;
    }

    update(game) {
        var gt = this.parent.getConvertedGameTime(game.time);

        var cleared = gt >= this.getClearTime();
        var crossed = gt >= this.time;
        if(!cleared) this.cleared = false;
        if(!crossed) this.crossed = false;

        if(cleared && !this.cleared && !this.isDummy()) {
            this.cleared = true;
        }

        if(crossed && !this.crossed) {
            this.crossed = true;

            if(gt - this.time < 10 && game.isPlaying && !this.isDummy()) {
                var ctx = game.audioContext;
                if(ctx && game.enableClickSound && ctx.state == "running") {
                    /** @type {AudioContext} */
                    var node = ctx.createBufferSource();
                    var fx = this.getAudioFX();
                    node.buffer = fx;
                    
                    node.connect(game.fxCompressor);
                    node.addEventListener("ended", e => {
                        node.disconnect();
                    });
                    node.start(0);
                }

                this.spawnJudge(game);
            }
        }
    }

    /**
     * @param {GameBase} game
     */
    getXPos(game) {
        var xPos = 0.845 * this.positionX / 15;
        var rp = this.parent.getRotatedPosition(game, { x: xPos, y: 0});
        var sp = this.parent.getScaledPosition(game, rp);
        sp.x -= game.getRenderXPad();
        sp.y -= game.canvas.height;
        sp.y *= 1.8 * game.getNoteRatio() / game.ratio;

        var fp = this.parent.getRotatedPosition(game, sp, this.parent.getLineRotation(game.time));
        xPos = fp.x;

        return xPos;
    }

    getYPos(game) {
        return this.parent.getYPosByFloorPos(game, this.floorPosition - this.parent.getCurrentFloorPosition());
    }

    /**
     * @param {GameBase} game
     */
    render(game) {
        var ctx = game.context;
        ctx.globalAlpha = this.getAlpha(game);
        if(game.renderDebug && !this.cleared && (!this.isOffScreen(game) || game.offScreenForceRender) && !this.isDummy()) {
            var yPos = -this.getYPos(game) * (this instanceof HoldNote ? 1 : (game.useUniqueSpeed ? 1 : this.speed)) + 40 * game.ratio;
            var xPos = this.getXPos(game);

            ctx.textAlign = "center";
            ctx.fillStyle = "#fff";
            ctx.font = `${28 * game.ratio}px ${Assets.preferredFont}`;
            ctx.fillText(`bpm=${this.parent.bpm} t=${this.time / 32} f=${this.floorPosition}`, xPos, yPos);
        }
    }

    getDetectWidth() {
        return this.noteWidth * 1.125 * game.getNoteRatio() / game.ratio;
    }

    /**
     * @param {GameBase} game
     */
    _renderTouchArea(game) {
        if(this.isDummy()) return;

        var gt = game.time;
        var t = this.time * 1875 / this.parent.bpm;
        var length = (this.holdTime || 0) * 1875 / this.parent.bpm;
        
        var distance = 0;
        if(gt >= t && gt <= t + length) {
            distance = 0
        } else if(gt > t + length) {
            distance = gt - t - length;
        } else {
            distance = t - gt;
        }

        if(distance > 250) return;

        var ctx = game.context;
        var alpha = ctx.globalAlpha;
        var h = ctx.canvas.height * 2;
        var xPos = this.getXPos(game);
        var width = this.getDetectWidth() * game.ratio;

        ctx.fillStyle = this.hasAnyTouchInRange(game) ? "#fc2" : "#2cf";
        var a = Math.max(0, Math.min(1, 1 - distance / 250));
        a = Math.pow(a, 2);
        ctx.globalAlpha = a * 0.25;
        ctx.fillRect(xPos - width / 2, -h, width, h * 2);
        ctx.fillStyle = "#fff";
        ctx.globalAlpha = alpha;
    }

    /**
     * 
     * @param {GameBase} game 
     */
    hasAnyTouchInRange(game) {
        var touches = game.touches;
        var ctx = game.context;
        var h = ctx.canvas.height * 2;
        var xPos = this.getXPos(game);
        var width = this.getDetectWidth() * game.ratio;

        var result = false;
        touches.forEach(t => {
            if(result) return;
            var pos = t.getTransformedPos(game, this.parent);
            if(Utils.inRect(xPos - width / 2, -h, width, h * 2, pos.x, pos.y)) {
                result = true;
                return;
            }
        });
        return result;
    }
}

var Utils = {
    inRange: (a, b, t) => {
        return t >= a && t <= b;
    },

    inRect: (x, y, w, h, x2, y2) => {
        return Utils.inRange(x, x + w, x2) && Utils.inRange(y, y + h, y2);
    }
};

class DummyNote extends Note {
    constructor() {
        super(NoteTypes.dummy);
    }

    static deserialize(raw) {
        var note = new DummyNote();
        Note._copyValuesToRef(note, raw);
        return note;
    }

    isDummy() {
        return true;
    }

    render(game) {
        super.render(game);
        if(!game.enableDummyNotes) return;
        if(this.isOffScreen(game) && !game.offScreenForceRender) return;

        var ctx = game.context;
        var ratio = game.getNoteRatio();
        var yPos = this.getYPos(game) * (game.useUniqueSpeed ? 1 : this.speed);
        var xPos = this.getXPos(game);

        var w = this.noteWidth * ratio;
        var h = (this.hasSibling ? 32 : 18) * ratio;

        if(!this.crossed) {
            // ctx.drawImage(this.hasSibling ? Assets.tapHL : Assets.tap, -w / 2 + xPos, -h / 2 - yPos, w, h);
            // ctx.beginPath();
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = "#fff";
            // ctx.arc(xPos, -yPos, 5 * ratio, 0, Math.PI * 2);
            // ctx.fill();
            var thickness = 8 * game.getNoteRatio();
            ctx.fillRect(-ctx.canvas.width * 2, -yPos - thickness / 2, ctx.canvas.width * 4, thickness);
            ctx.globalAlpha = 1;
        }
    }
}

class TapNote extends Note {
    constructor() {
        super(NoteTypes.tap);
    }

    static deserialize(raw) {
        var note = new TapNote();
        Note._copyValuesToRef(note, raw);
        return note;
    }

    /**
     * 
     * @param {GameBase} game 
     */
    render(game) {
        super.render(game);
        if(this.isOffScreen(game) && !game.offScreenForceRender) return;

        var ctx = game.context;
        var ratio = game.getNoteRatio();
        var yPos = this.getYPos(game) * (game.useUniqueSpeed ? 1 : this.speed);
        var xPos = this.getXPos(game);

        var w = this.noteWidth * ratio;
        var h = (this.hasSibling ? 32 : 18) * ratio;

        if(!this.cleared) {
            ctx.drawImage(this.hasSibling ? Assets.tapHL : Assets.tap, -w / 2 + xPos, -h / 2 - yPos, w, h);
        }
    }
}

class FlickNote extends Note {
    constructor() {
        super(NoteTypes.flick);
    }

    static deserialize(raw) {
        var note = new FlickNote();
        Note._copyValuesToRef(note, raw);
        return note;
    }

    getAudioFX() {
        return Assets.flickFx;
    }
    
    /**
     * 
     * @param {GameBase} game 
     */
    render(game) {
        super.render(game);
        if(this.isOffScreen(game) && !game.offScreenForceRender) return;

        var ctx = game.context;
        var ratio = game.getNoteRatio();
        var yPos = this.getYPos(game) * (game.useUniqueSpeed ? 1 : this.speed);
        var xPos = this.getXPos(game);

        var w = this.noteWidth * ratio;
        var h = (this.hasSibling ? 55 : 35) * ratio;

        if(!this.cleared) {
            ctx.drawImage(this.hasSibling ? Assets.flickHL : Assets.flick, -w / 2 + xPos, -h / 2 - yPos, w, h);
        }
    }
}

class HoldNote extends Note {
    constructor() {
        super(NoteTypes.hold);
        this.holdTime = 0;

        // Custom state
        this.lastJudge = 0;
    }

    doesClipOnPositiveSpeed() {
        return true;
    }

    static deserialize(raw) {
        var note = new HoldNote();
        Note._copyValuesToRef(note, raw);
        note.holdTime = raw.holdTime;
        return note;
    }

    getClearTime() {
        let ct = (this.time + this.holdTime) / (this.parent.bpm / 1875);
        ct -= 250;
        return Math.max(this.time, this.parent.getConvertedGameTime(ct));
    }

    isMissed() {
        // Temp workaround
        return false;
    }

    update(game) {
        super.update(game);

        let gt = this.parent.getConvertedGameTime(game.time);
        if(this.crossed && gt < this.time + this.holdTime) {
            var now = performance.now();
            if(now - this.lastJudge > 75) {
                this.lastJudge = now;
                this.spawnJudge(game);
            }
        } else {
            this.lastJudge = 0;
        }
    }
    
    /**
     * 
     * @param {GameBase} game 
     */
    render(game) {
        super.render(game);
        if(this.isOffScreen(game) && !game.offScreenForceRender) return;
        
        var ctx = game.context;
        var ratio = game.getNoteRatio();
        var yPos = this.getYPos(game);
        var xPos = this.getXPos(game);

        var w = this.noteWidth * ratio;
        var h = (this.parent.getYPosWithGame(game, this.time + this.holdTime) - this.parent.getYPosWithGame(game, this.time));

        let gt = this.parent.getConvertedGameTime(game.time);
        if (gt <= this.time + this.holdTime) {
            var headH = Assets.holdHead.height / Assets.holdHead.width * w;
            var endH = Assets.holdEnd.height / Assets.holdEnd.width * w;
            ctx.drawImage(Assets.holdEnd, -w / 2 + xPos, -yPos - h, w, endH);
            
            if (this.hasSibling) {
                w *= 1060 / 989 * 1.025;
                endH -= ratio * 1060 / 989;
            }
            ctx.drawImage(this.hasSibling ? Assets.holdHL : Assets.hold, -w / 2 + xPos, -yPos - h + endH, w, h - endH - headH);
            ctx.drawImage(this.hasSibling ? Assets.holdHLHead : Assets.holdHead, -w / 2 + xPos, -yPos - headH, w, headH);
        }
    }
}

class CatchNote extends Note {
    constructor() {
        super(NoteTypes.catch);
    }

    static deserialize(raw) {
        var note = new CatchNote();
        Note._copyValuesToRef(note, raw);
        return note;
    }

    getAudioFX() {
        return Assets.catchFx;
    }

    /**
     * 
     * @param {GameBase} game 
     */
    render(game) {
        super.render(game);
        if(this.isOffScreen(game) && !game.offScreenForceRender) return;
        
        var ctx = game.context;
        var ratio = game.getNoteRatio();
        var yPos = this.getYPos(game) * (game.useUniqueSpeed ? 1 : this.speed);
        var xPos = this.getXPos(game);

        var w = this.noteWidth * ratio * (this.hasSibling ? 1.08 : 1);
        var h = (this.hasSibling ? 28 : 12) * ratio;

        if(!this.cleared) {
            ctx.drawImage(this.hasSibling ? Assets.catchHL : Assets.catch, -w / 2 + xPos, -h / 2 - yPos, w, h);
        }
    }
}

class ChartEvent {
    constructor() {
        this.startTime = 0;
        this.endTime = 0;
    }

    serialize() {
        return Serializer.serialize(this);
    }
}

class SpeedEvent extends ChartEvent {
    constructor() {
        super();
        this.value = 1;
        this.floorPosition = 0;
    }

    static deserialize(raw) {
        return Serializer.deserialize(raw, SpeedEvent);
    }

    serialize() {
        return Serializer.serialize(this);
    }
}

class StateEvent extends ChartEvent {
    constructor() {
        super();

        // These 2 values are:
        //  - X value in move events.
        //  - Rotation degree in rotate events.
        this.start = 0;
        this.end = 0;

        // These 2 values seems to represent the Y value in move event.
        this.start2 = 0;
        this.end2 = 0;
    }
    
    static deserialize(raw) {
        var result = Serializer.deserialize(raw, StateEvent);
        result.start2 = result.start2 || 0;
        result.end2 = result.end2 || 0;
        return result;
    }
}

class JudgeLine {
    constructor() {
        this.index = -1;

        this.bpm = 0;

        /** @type {Image | null} */
        this.texture = null;

        /** @type {SpeedEvent[]} */
        this.speedEvents = [];

        /** @type {Note[]} */
        this.notesAbove = [];

        /** @type {Note[]} */
        this.notesBelow = [];

        /** @type {StateEvent[]} */
        this.judgeLineDisappearEvents = [];

        /** @type {StateEvent[]} */
        this.judgeLineMoveEvents = [];

        /** @type {StateEvent[]} */
        this.judgeLineRotateEvents = [];

        // Cache
        this.meter = [];

        this.currTime = -1;
        this.cachedLinePos = new Map();
        this.cachedLineRot = new Map();
        this.cachedLineAlpha = new Map();
        this.cachedFloorPosition = new Map();
    }

    serialize(withDummy = true) {
        var data = {};
        data.notesAbove = this.notesAbove.filter(n => {
            return withDummy || !(n instanceof DummyNote);
        }).map(n => {
            return n.serialize();
        });
        data.notesBelow = this.notesBelow.filter(n => {
            return withDummy || !(n instanceof DummyNote);
        }).map(n => {
            return n.serialize();
        });

        data.judgeLineDisappearEvents = this.judgeLineDisappearEvents.map(e => {
            return e.serialize();
        });
        data.judgeLineMoveEvents = this.judgeLineMoveEvents.map(e => {
            return e.serialize();
        });
        data.judgeLineRotateEvents = this.judgeLineRotateEvents.map(e => {
            return e.serialize();
        });
        
        data.speedEvents = this.speedEvents.map(v => {
            return v.serialize();
        });

        data.bpm = this.bpm;

        data.numOfNotesAbove = data.notesAbove.length;
        data.numOfNotesBelow = data.notesBelow.length;
        data.numOfNotes = data.numOfNotesAbove + data.numOfNotesBelow;
        return data;
    }

    static deserialize(raw, version, i, withDummy) {
        var line = new JudgeLine();
        line.index = i;

        line.bpm = raw.bpm;

        line.notesAbove = raw.notesAbove.filter(n => {
            return withDummy || n.type != -1;
        }).map(n => {
            var note = Note.deserialize(n);
            note.parent = line;
            return note;
        });
        line.notesBelow = raw.notesBelow.filter(n => {
            return withDummy || n.type != -1;
        }).map(n => {
            var note = Note.deserialize(n);
            note.parent = line;
            return note;
        });

        var posY = 0;
        line.speedEvents = raw.speedEvents.map(e => {
            var ev = SpeedEvent.deserialize(e);

            if (ev.floorPosition == null) {
                if (version >= 3) {
                    console.warn("Found a speed event without a floorPosition value! Calculating floor position...")
                }
                
                ev.floorPosition = posY;
                posY += ev.value * (ev.endTime - ev.startTime) / line.bpm * 1.875;
            }
            return ev;
        });

        line.judgeLineDisappearEvents = raw.judgeLineDisappearEvents.map(e => {
            return StateEvent.deserialize(e);
        });
        line.judgeLineRotateEvents = raw.judgeLineRotateEvents.map(e => {
            return StateEvent.deserialize(e);
        });
        line.judgeLineMoveEvents = raw.judgeLineMoveEvents.map(e => {
            var ev = StateEvent.deserialize(e);
            if(version == 3) return ev;

            // Finally found the way to decode the value...!
            var xCenter = 440;
            var yCenter = 260;

            var startX = Math.floor(ev.start / 1000);
            var startY = Math.round(ev.start % 1000);

            var endX = Math.floor(ev.end / 1000);
            var endY = Math.floor(ev.end % 1000);

            ev.start = startX / xCenter / 2;
            ev.start2 = startY / yCenter / 2;
            ev.end = endX / xCenter / 2;
            ev.end2 = endY / yCenter / 2;
            return ev;
        });

        // Sort the events so we can use binary search
        line.judgeLineDisappearEvents.sort((a, b) => a.startTime - b.startTime);
        line.judgeLineRotateEvents.sort((a, b) => a.startTime - b.startTime);
        line.judgeLineMoveEvents.sort((a, b) => a.startTime - b.startTime);

        return line;
    }

    /**
     * 
     * @param {GameBase} game 
     * @param {{x: number, y: number}} pos 
     */
    getScaledPosition(game, pos) {
        var x = pos.x;
        var y = pos.y;
        var pad = game.getRenderXPad();
        var cw = game.canvas.width - pad * 2;
        var ch = game.canvas.height;

        x = 0.5 * cw + (x - 0.5) * cw + pad;
        y = ch - 0.5 * ch - (y - 0.5) * ch;
        return {x, y};
    }

    getRotatedPosition(game, linePos, angle) {
        linePos = linePos ?? this.getLinePosition(game.time);
        angle = angle ?? this.getLineRotation(game.time);

        var rad = angle / 180 * Math.PI;
        var c = Math.cos(rad);
        var s = Math.sin(rad);

        var _x = (c * linePos.x - s * linePos.y);
        var _y = (s * linePos.x + c * linePos.y);
        return {
            x: _x,
            y: _y
        };
    }

    update(game) {
        this.notesAbove.forEach(n => n.update(game));
        this.notesBelow.forEach(n => n.update(game));
    }

    /**
     * 
     * @param {GameBase} game 
     */
    render(game, queue) {
        var ctx = game.context;
        var cw = ctx.canvas.width - game.getRenderXPad() * 2;
        var ch = ctx.canvas.height;
        var ratio = game.ratio;
        var t = ctx.getTransform();
        var time = game.time;

        this.currTime = time;
        this.cachedLinePos.clear();
        this.cachedLineRot.clear();
        this.cachedLineAlpha.clear();
        this.cachedFloorPosition.clear();
        var linePos = this.getScaledPosition(game, this.getLinePosition(time));
        var lineRot = -this.getLineRotation(time) / 180 * Math.PI;

        ctx.translate(linePos.x, linePos.y);
        ctx.rotate(lineRot);

        /**
         * @param {Note} n 
         */
        let noteRenderFn = n => {
            if(n.isOffScreen(game) && !game.offScreenForceRender) return;

            var f = this.getCurrentFloorPosition();

            var doClip = n instanceof HoldNote;
            /*
            var doClip = f != f ?
                (this.getSpeed(game.time) < 0 ? n.doesClipOnPositiveSpeed() : true) :
                n.floorPosition < this.getCurrentFloorPosition();
            */

            if(game.renderDebug) {
                n._renderTouchArea(game);
            }
            
            if(doClip) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(-cw, -ch * 2, cw * 2, ch * 2);
                ctx.clip();
            }
            n.render(game);

            if(doClip) {
                ctx.restore();
            }
        };

        this.notesAbove.filter(n => n instanceof HoldNote).forEach(noteRenderFn);
        this.notesAbove.filter(n => !(n instanceof HoldNote)).forEach(noteRenderFn);

        ctx.scale(1, -1);
        
        this.notesBelow.filter(n => n instanceof HoldNote).forEach(noteRenderFn);
        this.notesBelow.filter(n => !(n instanceof HoldNote)).forEach(noteRenderFn);

        ctx.scale(1, -1);
        ctx.globalAlpha = 1;

        var lt = ctx.getTransform();
        ctx.setTransform(t);

        queue.push(() => {
            ctx.setTransform(lt);
            ctx.globalAlpha = this.getLineAlpha(time);
            ctx.fillStyle = "#fff";

            if (game.renderDebug) {
                // ctx.globalAlpha *= 0.875;
                // ctx.globalAlpha += 0.125;
                ctx.beginPath();
                ctx.arc(0, 0, 20 * game.ratio, 0, 2 * Math.PI);
                ctx.fill();
            }

            if (this.texture == null) {
                var thickness = 8 * game.getNoteRatio();
                ctx.fillRect(-cw * 2, thickness / -2, cw * 4, thickness); 
            } else {
                var img = this.texture;
                var unit = 900;
                var iw = img.width / unit * ch; 
                var ih = img.height / unit * ch;

                var xOffset = ih * (this.texturePos[0] - 1) / 4;
                var yOffset = ih * (this.texturePos[1] - 1) / 4;

                ctx.drawImage(img, -iw / 2 - xOffset, -ih / 2 - yOffset, iw, ih);
                ctx.setTransform(lt);
            }

            if(game.renderDebug) {
                ctx.textAlign = "center";
                ctx.font = `${28 * game.ratio}px ${Assets.preferredFont}`;

                if (this.notesAbove.length + this.notesBelow.length > 0) {
                    ctx.fillText(`[${this.index}] bpm=${this.bpm} t=${Math.floor(this.getConvertedGameTime(game.time) / 32)} f=${this.getCurrentFloorPosition()}`,
                        0, -24 * ratio);
                } else {
                    ctx.fillText(`[${this.index}] bpm=${this.bpm}`, 0, -24 * ratio);
                }
            }

            ctx.fillStyle = "#000";
            ctx.globalAlpha = 1;
            ctx.setTransform(t);
        });
    }

    // The game time refers to the unit used in the chart.
    getConvertedGameTime(time) {
        // Phigros is using a kind of unit which 32 units are a beat.
        // The length of an unit can be calculated by the formula below.
        // Unit = (Line BPM) / 60 * 32 / 1000 ms.
        return time * (this.bpm / 1875);
    }

    getRealTime(time) {
        return time * 1875 / this.bpm;
    }

    /**
     * @param {number} time
     */
    getYPosition(game, time) {
        return this.getYPosByFloorPos(game, this.getCalculatedFloorPosition(time));
    }

    getYPosByFloorPos(game, floor) {
        return floor * game.canvas.height * 0.6;
    }

    getYPosWithGame(game, time) {
        var gt = this.getConvertedGameTime(game.time);
        return this.getYPosition(game, time) - this.getYPosition(game, gt);
    }

    getCurrentFloorPosition() {
        var time = this.getConvertedGameTime(game.time);
        return this.getCalculatedFloorPosition(time);
    }

    getCalculatedFloorPosition(time) {
        if (this.cachedFloorPosition.has(time))
            return this.cachedFloorPosition.get(time);
        var event = findEvent(this.speedEvents, time);
        if(event == null) event = this.speedEvents[0];
        if(event == null) return 0;
        
        var result = event.floorPosition + this.getRealTime(time - event.startTime) / 1000 * event.value;
        this.cachedFloorPosition.set(time, result);
        return result;
    }

    recalculateSpeedEventsFloorPosition() {
        var posY = 0;
        this.speedEvents.forEach(ev => {
            ev.floorPosition = posY;
            posY += ev.value * (ev.endTime - ev.startTime) / this.bpm * 1.875;
        });
    }

    recalculateNotesFloorPosition() {
        this.notesAbove.forEach(n => {
            var time = n.time;
            var event = findEvent(this.speedEvents, time);
            if(event == null) event = this.speedEvents[0];
            if(event == null) return 0;
            
            n.floorPosition = event.floorPosition + this.getRealTime(time - event.startTime) / 1000 * event.value;
        });
    }

    recalculateFloorPosition() {
        this.recalculateSpeedEventsFloorPosition();
        this.recalculateNotesFloorPosition();
    }

    getSpeed(_time) {
        var time = this.getConvertedGameTime(_time);
        var event = findEvent(this.speedEvents, time);
        if(event == null) event = this.speedEvents[0];
        if(event == null) return 1;
        
        return event.value;
    }

    getLinePosition(_time) {
        if (this.cachedLinePos.has(_time)) {
            return this.cachedLinePos.get(_time);
        }

        var time = this.getConvertedGameTime(_time);
        var event = findEvent(this.judgeLineMoveEvents, time);
        if (event == null) event = this.judgeLineMoveEvents[0];
        if (event == null) {
            var r = {
                x: 0.5, y: 0.5
            };
            this.cachedLinePos.set(_time, r);
            return r;
        }

        var progress = (time - event.startTime) / (event.endTime - event.startTime);
        var result = {
            x: K.Maths.lerp(event.start, event.end, progress),
            y: K.Maths.lerp(event.start2, event.end2, progress)
        };
        this.cachedLinePos.set(_time, result);
        return result;
    }

    getLineRotation(_time) {
        if (this.cachedLineRot.has(_time)) {
            return this.cachedLineRot.get(_time);
        }

        var time = this.getConvertedGameTime(_time);
        var event = findEvent(this.judgeLineRotateEvents, time);
        if (event == null) event = this.judgeLineRotateEvents[0];
        if (event == null) return 0;

        var progress = (time - event.startTime) / (event.endTime - event.startTime);
        var result = K.Maths.lerp(event.start, event.end, progress);
        this.cachedLineRot.set(_time, result);
        return result;
    }

    getLineAlpha(_time) {
        if (this.cachedLineAlpha.has(_time)) {
            return this.cachedLineAlpha.get(_time);
        }

        var time = this.getConvertedGameTime(_time);
        var event = findEvent(this.judgeLineDisappearEvents, time);
        if (event == null) event = this.judgeLineDisappearEvents[0];
        if (event == null) return 1;

        // 0 duration disappear events?
        if (event.endTime == event.startTime) {
            return (event.start + event.end) / 2;
        }

        var progress = (time - event.startTime) / (event.endTime - event.startTime);
        var result = K.Maths.lerp(event.start, event.end, progress);
        this.cachedLineAlpha.set(_time, result);
        return result;
    }
}

class Chart {
    constructor() {
        this.offset = 0;

        /** @type {JudgeLine[]} */
        this.judgeLineList = [];
    }

    static deserialize(raw, withDummy) {
        var chart = new Chart();
        var formatVersion = raw.formatVersion;
        chart.offset = raw.offset;

        chart.judgeLineList = raw.judgeLineList.map((j, i) => {
            return JudgeLine.deserialize(j, formatVersion, i, withDummy);
        });

        chart.solveSiblings();

        return chart;
    }

    solveSiblings() {
        var chart = this;
        chart.judgeLineList.forEach(line => {
            line.notesAbove.forEach(n => {
                if(n.isDummy()) return;
                var t = n.time;
                chart.judgeLineList.forEach(l2 => {
                    l2.notesAbove.forEach(n2 => {
                        if(n2.isDummy()) return;
                        if(Math.abs(n2.time - t) < 1 && n2 != n) {
                            n2.hasSibling = true;
                            n.hasSibling = true;
                        }
                    });
                    l2.notesBelow.forEach(n2 => {
                        if(n2.isDummy()) return;
                        if(Math.abs(n2.time - t) < 1 && n2 != n) {
                            n2.hasSibling = true;
                            n.hasSibling = true;
                        }
                    });
                });
            });
            
            line.notesBelow.forEach(n => {
                if(n.isDummy()) return;
                var t = n.time;
                chart.judgeLineList.forEach(l2 => {
                    l2.notesAbove.forEach(n2 => {
                        if(Math.abs(n2.time - t) < 1 && n2 != n) {
                            if(n2.isDummy()) return;
                            n2.hasSibling = true;
                            n.hasSibling = true;
                        }
                    });
                    l2.notesBelow.forEach(n2 => {
                        if(Math.abs(n2.time - t) < 1 && n2 != n) {
                            if(n2.isDummy()) return;
                            n2.hasSibling = true;
                            n.hasSibling = true;
                        }
                    });
                });
            });
        });
    }

    serialize() {
        var data = Serializer.serialize(this, [
            "offset"
        ]);
        data.formatVersion = 3;

        data.judgeLineList = this.judgeLineList.map(v => {
            return v.serialize();
        });

        data.numOfNotes = 0;
        data.judgeLineList.forEach(j => {
            data.numOfNotes += j.numOfNotes;
        });

        return data;
    }

    recalculateFloorPosition() {
        this.judgeLineList.forEach(ln => ln.recalculateFloorPosition());
    }
}

/** Chart elements end **/

class TouchInput {
    constructor() {
        this.state = 0;
        this.id = -1;
        this.xPos = 0;
        this.yPos = 0;

        this.dX = 0;
        this.dY = 0;
    }

    getDeltaDistance() {
        var dx = this.dX;
        var dy = this.dY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 
     * @param {GameBase} game 
     * @param {JudgeLine} line 
     */
    getTransformedPos(game, line) {
        // We will now do some matrix transformation here.
        var x = this.xPos;
        var y = this.yPos;

        var linePos =  line.getScaledPosition(game, line.getLinePosition(game.time));
        linePos.x *= -1;
        linePos.y *= -1;

        var rad = line.getLineRotation(game.time) / 180 * Math.PI;
        var c = Math.cos(rad);
        var s = Math.sin(rad);

        // var _x = c * x - s * y + linePos.x;
        // var _y = s * x + c * y + linePos.y;
        var _x = c * x - s * y + (c * linePos.x - s * linePos.y);
        var _y = s * x + c * y + (s * linePos.x + c * linePos.y);

        return { 
            x: _x,
            y: _y
        };
    }
}

class GameBase {
    convertTouchXY(x, y) {
        let offsetLeft = this.canvas.offsetLeft;
        let offsetTop = this.canvas.offsetTop;

        if (this.canvas.classList.contains("fullscreen")) {
            offsetLeft = document.body.scrollLeft;
            offsetTop = document.body.scrollTop;
        }

        return {
            x: (x - offsetLeft) / this.canvas.offsetWidth * this.canvas.width,
            y: (y - offsetTop) / this.canvas.offsetHeight * this.canvas.height
        };
    }

    handleTouchStart(id, x, y) {
        var nt = new TouchInput();
        let cv = this.convertTouchXY(x, y);
        nt.xPos = cv.x;
        nt.yPos = cv.y;
        nt.id = id;
        this.touches.push(nt);
    }

    handleTouchMove(id, x, y) {
        var nt = this.touches.find(n => {
            return n.id == id;
        });

        if(nt == null) {
            console.warn(`touchMove: TouchInput id ${id} not found!`);
            return;
        }

        let cv = this.convertTouchXY(x, y);
        var _x = cv.x;
        var _y = cv.y;

        nt.dX = _x - nt.xPos;
        nt.dY = _y - nt.yPos;

        nt.xPos = _x;
        nt.yPos = _y;
    }

    handleTouchEnd(id) {
        var nt = this.touches.findIndex(n => {
            return n.id == id;
        });

        if(nt == -1) {
            console.warn(`touchEnd: TouchInput id ${id} not found!`);
            return;
        }

        this.touches.splice(nt, 1);
    }

    handleTouchCancel(id) {
        var nt = this.touches.findIndex(n => {
            return n.id == id;
        });

        if(nt == -1) {
            console.warn(`touchCancel: TouchInput id ${id} not found!`);
            return;
        }

        this.touches.splice(nt, 1);
    }

    /**
     * 
     * @param {HTMLCanvasElement} canvas 
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.context = canvas.getContext("2d");

        this.refScreenWidth = 1440; // 1920;
        this.refScreenHeight = 1080;

        this.setResolutionScale(devicePixelRatio);

        /** @type {Chart} */
        this.chart = null;

        /** @type {HTMLAudioElement} */
        this.audioElem = document.getElementById("game-audio");

        /** @type {AudioBufferSourceNode} */
        this.audioSource = null;

        this.backgroundBlur = 20;
        this.backgroundDim = 0.66;

        this.audioOffset = 0;

        // Game state
        this.isPlaying = false;
        this.time = 0;
        this._startTime = 0;
        this.background = null;
        this.songName = "Song name";
        this.diffName = "IN";
        this.diffLevel = 13;
        this.deltaTime = 0;
        this.lastRenderTime = performance.now();
        this.maxFps = 300;
        this.maxRatio = 16 / 9;

        /** @type {TouchInput[]} */
        this.touches = [];

        this.smooth = 100;
        this.renderDebug = false;
        this.enableClickSound = true;
        this.enableParticles = true;
        this.useUniqueSpeed = false;
        this.offScreenForceRender = false;
        this.enableDummyNotes = true;

        this.useAnimationFrame = false;

        /** @type {Uint8Array} */
        this.lastAnalysedAudio = null;

        /** @type {AnalyserNode} */
        this.audioAnalyser = null;

        // Events
        this.canvas.addEventListener("touchstart", e => {
            e.preventDefault();
            var touches = e.changedTouches;
            for(var i=0; i<touches.length; i++) {
                var t = touches[i];
                this.handleTouchStart(t.identifier, t.pageX, t.pageY);
            }
        });

        this.canvas.addEventListener("touchmove", e => {
            e.preventDefault();
            var touches = e.changedTouches;
            for(var i=0; i<touches.length; i++) {
                var t = touches[i];
                this.handleTouchMove(t.identifier, t.pageX, t.pageY);
            }
        });

        this.canvas.addEventListener("touchend", e => {
            e.preventDefault();
            var touches = e.changedTouches;
            for(var i=0; i<touches.length; i++) {
                var t = touches[i];
                this.handleTouchEnd(t.identifier);
            }
        });

        this.canvas.addEventListener("touchcancel", e => {
            e.preventDefault();
            var touches = e.changedTouches;
            for(var i=0; i<touches.length; i++) {
                var t = touches[i];
                this.handleTouchCancel(t.identifier);
            }
        });

        this.canvas.addEventListener("mousedown", e => {
            e.preventDefault();
            this.handleTouchStart("mouse", e.pageX, e.pageY);
        });

        this.canvas.addEventListener("mousemove", e => {
            e.preventDefault();
            var t = this.touches.find(n => {
                return n.id == "mouse";
            });
            if(t != null) {
                this.handleTouchMove("mouse", e.pageX, e.pageY);
            }
        });

        this.canvas.addEventListener("mouseup", e => {
            e.preventDefault();
            this.handleTouchEnd("mouse", e.pageX, e.pageY);
        });

        this.canvas.addEventListener("mouseout", e => {
            e.preventDefault();
            var t = this.touches.find(n => {
                return n.id == "mouse";
            });
            if(t != null) {
                this.handleTouchEnd("mouse", e.pageX, e.pageY);
            }
        });

        /** @type {AnimatedObject[]} */
        this.animatedObjects = [];

        /** @type {AudioContext} */
        var clz = window.AudioContext || window.webkitAudioContext;
        if(clz) {
            /** @type {AudioContext} */
            var audioContext = this.audioContext = new clz();
            
            var gain = this.mainGainNode = audioContext.createGain();
            gain.gain.value = 1;
            gain.connect(audioContext.destination);

            var analyser = this.audioAnalyser = audioContext.createAnalyser();
            analyser.connect(gain);

            // Using all the frequencies results in lower average volume, 
            // so we will only use the lower frequencies.
            var fb = Math.round(analyser.frequencyBinCount / 1024 * 64);
            this.lastAnalysedAudio = new Uint8Array(fb);
            
            var fxGain = this.fxGainNode = audioContext.createGain();
            fxGain.gain.value = 0.35;
            fxGain.connect(audioContext.destination);

            var compressor = this.fxCompressor = audioContext.createDynamicsCompressor();
            compressor.connect(fxGain);
        }

        this.setupAudio();
        this.setupImageAssets();
        this.setupAudioAssets();

        this.update();
        this.fixedUpdate();
        this.render();
    }

    setResolutionScale(sc) {
        this.ratio = sc;
        this.canvas.width = Math.max(screen.width * sc, screen.height * sc);
        this.canvas.height = Math.min(screen.width * sc, screen.height * sc);
    }

    setupAudio() {
        var ctx = this.audioContext;

        if(window.AudioContext) {
            var source = ctx.createMediaElementSource(this.audioElem);
            var gain = ctx.createGain();
            gain.gain.value = 0;
            source.connect(gain).connect(ctx.destination);
        }

        this.audioElem.volume = 0.3;

        this.audioElem.addEventListener("play", e => {
            this.isPlaying = true;

            if(window.AudioContext) {
                this.audioSource.playbackRate.value = this.audioElem.playbackRate;
                this.audioSource.loop = this.audioElem.loop;
                this.audioSource.start(0, this.audioElem.currentTime);
            }
        });

        this.audioElem.addEventListener("pause", e => {
            this.isPlaying = false;
            
            if(window.AudioContext) {
                this.audioSource.stop();
                this.audioSource.disconnect();
                
                var src = new AudioBufferSourceNode(ctx);
                src.buffer = this.audioData;
                src.connect(this.audioAnalyser);
                this.audioSource = src;
            }
        });
    }

    setupImageAssets() {
        Assets.loadImageAsset("tap", "./assets/Tap2.png");
        Assets.loadImageAsset("flick", "./assets/Flick2.png");
        Assets.loadImageAsset("catch", "./assets/Drag (1).png");
        Assets.loadImageAsset("tapHL", "./assets/Tap2HL.png");
        Assets.loadImageAsset("flickHL", "./assets/Flick2HL.png");
        Assets.loadImageAsset("catchHL", "./assets/DragHL.png");

        Assets.loadImageAsset("hold", "./assets/Hold.png");
        Assets.loadImageAsset("holdHead", "./assets/Hold_Head.png");
        Assets.loadImageAsset("holdEnd", "./assets/Hold_End.png");
        
        Assets.loadImageAsset("holdHL", "./assets/Hold2HL_1.png");
        Assets.loadImageAsset("holdHLHead", "./assets/Hold2HL_0.png");
    }

    setupAudioAssets() {
        Assets.loadAudioAsset("fx", "./assets/fx1.wav", this);
        Assets.loadAudioAsset("catchFx", "./assets/click_01.wav", this);
        Assets.loadAudioAsset("flickFx", "./assets/drag_01.wav", this);
    }

    /**
     * 
     * @param {AudioContext} ctx 
     * @param {*} buffer 
     */
    _decodeAudioData(ctx, buffer) {
        if(window.AudioContext) {
            return ctx.decodeAudioData(buffer);
        } else {
            return new Promise((resolve, reject) => {
                ctx.decodeAudioData(buffer, resolve, reject);
            });
        }
    }

    getRenderXPad() {
        var canvas = this.canvas;
        var maxRatio = this.maxRatio;
        if(canvas.width / canvas.height > maxRatio) {
            return (canvas.width - (canvas.height * maxRatio)) / 2;
        }
        return 0;
    }

    async loadChartWithAudio({ chartPath, audioPath, lineTextures, performance }) {
        var chart = await (await fetch(chartPath, { cache: "no-cache" })).json();
        chart = Chart.deserialize(chart, true);
        this.chart = chart;
        this.handleLineTextures(lineTextures);
        this.performance = performance ?? null;
        
        await this.loadAudio(audioPath);
    }

    async loadAudio(audioPath) {
        this.isPlaying = false;
        this.audioElem.pause();
        this.audioElem.src = audioPath;

        var ctx = this.audioContext;
        if(ctx) {
            var buffer = await (await fetch(audioPath)).arrayBuffer();
            var audio = await this._decodeAudioData(this.audioContext, buffer);
            this.audioData = audio;

            var source = this.audioContext.createBufferSource();
            source.audioContext = this.audioContext;
            source.buffer = audio;
            this.replaceAudio(source);
        } else {
            this._startTime = performance.now();
        }
    }

    replaceAudio(newSource) {
        if(!this.audioContext) return;

        if(this.audioSource != null) {
            this.audioSource.disconnect();
        }
        
        newSource.connect(this.audioAnalyser);
        this.audioSource = newSource;
    }

    setPlaybackRate(rate) {
        this.audioElem.playbackRate = rate;
        this.audioSource.playbackRate.value = rate;
    }

    getNoteRatio() {
        var w = this.canvas.width - this.getRenderXPad() * 2;
        var h = this.canvas.height;
        var aspect = w / h;
        var refAspect = 1920 / 1080;

        var mult = 1;
        if (aspect < refAspect) {
            mult = K.Maths.lerp(1, aspect / refAspect, 0.8);
        }
        return this.ratio * mult;
    }

    updateTime(isRender) {
        var dt = isRender ? this.deltaTime : 1;

        var offset = this.chart ? this.chart.offset * 1000 : 0;
        offset += this.audioOffset;
        var smooth = Math.max(0, Math.min(1, (dt / this.smooth)));
        
        if (!this.isPlaying) {
            this.time = K.Maths.lerp(this.time, this.audioContext ? this.audioElem.currentTime * 1000 + offset : p - this._startTime, smooth);
        } else {
            this.time += dt * this.audioElem.playbackRate;
            var actualTime = this.audioContext ? this.audioElem.currentTime * 1000 + offset : p - this._startTime;
            if (Math.abs(this.time - actualTime) > 16) this.time = actualTime;
        }
    }

    // Update
    update() {
        setTimeout(() => this.update(), 0);

        if(this.mainGainNode) {
            this.mainGainNode.gain.value = this.audioElem.volume;
        }
        this.updateTime(false);

        if(!this.audioContext) {
            this.isPlaying = true;
        }

        this.audioAnalyser.getByteFrequencyData(this.lastAnalysedAudio);

        if (this.chart == null) return;
        this.chart.judgeLineList.forEach(l => {
            l.update(this);
        });
    }

    fixedUpdate() {
        window.setTimeout(() => {
            this.fixedUpdate();
        }, 5);

        this.animatedObjects.forEach(obj => {
            obj.fixedUpdate();
        });
    }

    render() {
        if (this.useAnimationFrame) {
            window.requestAnimationFrame(() => {
                this.render();
            });
        } else {
            window.setTimeout(() => {
                this.render();
            }, 0);
        }

        var p = performance.now();
        this.deltaTime = p - this.lastRenderTime;

        if(this.deltaTime < 1000 / this.maxFps) {
            return;
        }

        this.lastRenderTime = p;
        this.updateTime(true);

        (() => {
            let refAspect = this.refScreenWidth / this.refScreenHeight;
            let width = this.canvas.width - this.getRenderXPad();
            let height = this.canvas.height;
            let aspect = width / height;

            if (aspect > refAspect) { // wider
                this.ratio = height / this.refScreenHeight;
            } else {
                this.ratio = width / this.refScreenWidth;
            }
        })();

        this._renderReset();
        this._renderBack();
        this._renderJudgeLines();

        var removalObjects = [];
        this.animatedObjects.forEach((o, i) => {
            o.update();
            if(o.notNeeded) {
                removalObjects.unshift(i);
            }
        });
        removalObjects.forEach(i => {
            this.animatedObjects.splice(i, 1);
        });

        this._renderUI();

        this.touches.forEach(t => {
            if(t.state == 0) t.state = 1;
        });

        if(innerWidth < innerHeight) {
            this.canvas.classList.remove("fullscreen");
        }
    }

    _renderBack() {
        var ctx = this.context;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        if(this.background && this.background instanceof Image) {
            try {
                var pad = this.getRenderXPad();
                var iw = this.background.width;
                var ih = this.background.height;

                var osc = this.blurOffscreenCanvas;
                if (!osc) {
                    osc = this.blurOffscreenCanvas = document.createElement("canvas");
                    this.blurOffscreenContext = osc.getContext("2d");
                }
                osc.width = ctx.canvas.width;
                osc.height = ctx.canvas.height;

                var oCtx = this.blurOffscreenContext;
                if (iw / ih > ctx.canvas.width / ctx.canvas.height) {
                    var xOffset = (ctx.canvas.width - pad * 2) - ctx.canvas.height / ih * iw;
                    var ox = pad + xOffset / 2 - ctx.canvas.width / 2;
                    var oy = -ctx.canvas.height / 2;
                    var ow = iw / ih * oCtx.canvas.height;
                    var oh = oCtx.canvas.height;
                } else {
                    var xOffset = -pad * 2;
                    var yOffset = ctx.canvas.height - ctx.canvas.width / iw * ih;
                    var ox = pad + xOffset / 2 - ctx.canvas.width / 2;
                    var oy = -ctx.canvas.height / 2 + yOffset / 2;
                    var ow = oCtx.canvas.width;
                    var oh = oCtx.canvas.width * ih / iw;
                }

                // Background of padding
                ctx.globalAlpha = 0.4;
                (() => {
                    let t = ctx.getTransform();
                    ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
                    ctx.drawImage(this.background, ox, oy, ow, oh);
                    console.log(ox, oy, ow, oh);
                    ctx.setTransform(t);
                })();

                // Background of play area
                ctx.globalAlpha = 1;

                ctx.save();
                ctx.beginPath();
                ctx.rect(pad, 0, ctx.canvas.width - pad * 2, ctx.canvas.height);
                ctx.clip();

                // Render blurred background
                var t = oCtx.getTransform();
                oCtx.filter = `blur(${this.backgroundBlur * this.ratio}px)`;
                oCtx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
                oCtx.scale(1, 1);
                oCtx.drawImage(this.background, ox, oy, ow, oh);
                oCtx.setTransform(t);
                ctx.drawImage(osc, 0, 0, ctx.canvas.width, ctx.canvas.height);

                // Dim
                ctx.globalAlpha = this.backgroundDim;
                ctx.fillRect(pad, 0, ctx.canvas.width - pad * 2, ctx.canvas.height);
                ctx.restore();

                // Reset alpha
                ctx.globalAlpha = 1;
            } catch (ex) {
                console.error(ex);
                ctx.fillStyle = "#000";
                ctx.globalAlpha = 1;
                ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

                ctx.fillStyle = "#fff";
                ctx.globalAlpha = 0.25;
                ctx.textBaseline = "middle";
                ctx.textAlign = "center";
                var ratio = this.ratio * 1.25;
                ctx.font = `${36 * ratio}px ` + Assets.preferredFont;
                ctx.fillText("Invalid background!", ctx.canvas.width / 2, ctx.canvas.height / 2, ctx.canvas.width * 0.8);

                ctx.globalAlpha = 1;
            }
        }
    }

    _renderJudgeLines() {
        var ctx = this.context;
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.getRenderXPad(), 0, ctx.canvas.width - this.getRenderXPad() * 2, ctx.canvas.height);
        ctx.clip();

        if(this.chart == null) return;
        var lineQueue = [];
        this.chart.judgeLineList.forEach(line => {
            line.render(this, lineQueue);
        });

        lineQueue.forEach(q => {
            q();
        });

        ctx.restore();
        ctx.fillStyle = "#fff";
    }

    _renderUI() {
    }

    _renderReset() {
        var ctx = this.context;
        ctx.restore();
        ctx.textAlign = "left";
        ctx.fillStyle = "#000";
    }

    handleLineTextures(textures) {
        if (typeof textures === "undefined") return;
        textures.forEach(meta => {
            if (typeof meta.image !== "undefined" && typeof meta.index !== "undefined") {
                var line = this.chart.judgeLineList[meta.index];
                var img = new Image();
                img.src = meta.image;
                line.texture = img;
                line.texturePos = meta.pos ?? [1, 1];
            }
        });
    }
}

class Phigros extends GameBase {
    constructor(canvas) {
        super(canvas);
        Phigros.currentGame = this;
    }

    _renderUI() {
        var ctx = this.context;
        var cw = ctx.canvas.width;
        var ch = ctx.canvas.height;
        var ratio = this.ratio * 1.25;

        var count = 0;
        var combo = 0;
        var score = 0;

        var maxValidTime = this.audioElem.duration * 1000;

        var beat = 0;
        if (this.chart != null) {
            beat = this.chart.judgeLineList[0].getConvertedGameTime(this.time) / 32;
        }

        if(this.chart != null) {
            this.chart.judgeLineList.forEach(line => {
                line.notesAbove.forEach(n => {
                    if(n.isDummy()) return;
                    if(n.cleared) combo++;
                    if (line.getRealTime(n.time) <= maxValidTime) count++;
                });
                line.notesBelow.forEach(n => {
                    if(n.isDummy()) return;
                    if(n.cleared) combo++;
                    if (line.getRealTime(n.time) <= maxValidTime) count++;
                });
            });
        }

        if (this.performance == "apf2023") {
            if (beat < 336) {
                count = 305;
            } else if (beat < 340) {
                var progress = (beat - 336) / 4;
                progress = Math.pow(progress, 1);
                count = K.Maths.lerp(305, count, progress);
            }
        }

        var scoreStr = "";
        var maxScore = 1000000;
        score = count == 0 ? 0 : Math.round(maxScore * (Math.min(combo, count) / count));
        for(var i=0; i <= Math.log10(maxScore) - 2 - Math.floor(score == 0 ? 0 : Math.log10(score)) + 1; i++) {
            scoreStr += "0";
        }
        scoreStr += score;

        var pad = this.getRenderXPad();
        // -- Play bar
        (() => {
            ctx.fillStyle = "#fff";
            var offset = this.chart ? this.chart.offset * 1000 : 0;
            offset += this.audioOffset;

            var duration = this.audioElem.duration;
            var curr = (this.time - offset) / 1000;
            var audioCurr = this.audioElem.currentTime;

            if (this.performance == "apf2023") {
                if (beat < 336) {
                    duration = 120;
                } else {
                    var arr = this.lastAnalysedAudio;
                    
                    var f = 0;
                    arr.forEach(i => f += i);
                    f /= arr.length;

                    duration = 255;
                    curr = audioCurr = f;
                }
            }

            ctx.globalAlpha = 0.3;
            ctx.fillRect(pad, 0, curr / duration * (this.canvas.width - pad * 2), 10 * this.ratio);

            ctx.fillStyle = "#fff";
            ctx.fillRect(pad, 0, audioCurr / duration * (this.canvas.width - pad * 2), 10 * this.ratio);
            ctx.globalAlpha = 1;

            ctx.fillRect(curr / duration * (this.canvas.width - pad * 2) + pad,
                0,
                2.5 * ratio + audioCurr / duration * (this.canvas.width - pad * 2)
                    - (curr / duration * (this.canvas.width - pad * 2)), 
                10 * this.ratio);
        })();

        // -- Pause button
        ctx.fillStyle = "#000";
        ctx.globalAlpha = 0.5;
        ctx.fillRect(30 * ratio + pad, 32 * ratio, 9 * ratio, 29 * ratio);
        ctx.fillRect(47 * ratio + pad, 32 * ratio, 9 * ratio, 29 * ratio);
        ctx.fillStyle = "#fff";
        ctx.globalAlpha = 1;
        ctx.fillRect(26 * ratio + pad, 28 * ratio, 9 * ratio, 29 * ratio);
        ctx.fillRect(43 * ratio + pad, 28 * ratio, 9 * ratio, 29 * ratio);

        // -- Song title
        ctx.fillStyle = "#fff";
        // ctx.fillRect(pad + 30 * ratio, ch - 62 * ratio, 7.5 * ratio, 35 * ratio);

        ctx.textAlign = "left";
        ctx.font = `${28 * ratio}px ` + Assets.preferredFont;

        var metrics = ctx.measureText(this.songName);
        var sScale = metrics.width > (545 * ratio) ? (545 * ratio) / metrics.width : 1;
        ctx.font = `${28 * ratio * sScale}px ` + Assets.preferredFont;
        ctx.textBaseline = "middle";
        ctx.fillText(this.songName, pad + 40 * ratio, ch - 45 * ratio);

        // -- Song difficulty & level
        (() => {
            ctx.font = `${28 * ratio}px ` + Assets.preferredFont;
            ctx.textAlign = "right";
            
            var text = `${this.diffName} Lv.${this.diffLevel < 0 ? "?" : this.diffLevel}`;
            if (this.performance == "apf2023" && beat < 336) {
                text = "lN Lv.I2";
            }

            ctx.fillText(text, cw - pad - 40 * ratio, ch - 45 * ratio);
        })();

        // -- Combo
        ctx.textBaseline = "alphabetic";
        if(combo >= 3) {
            ctx.textAlign = "center";
            ctx.font = `500 ${22 * ratio}px ` + Assets.preferredFont;
            ctx.fillText("COMBO", cw / 2, 87 * ratio);
            ctx.font = `500 ${58 * ratio}px ` + Assets.preferredFont;

            if (this.performance == "apf2023" && beat >= 650 && beat < 716) {
                var e1 = "(⊙o⊙)";

                if (beat < 652) {
                    combo = e1;
                } else {
                    var b = (beat - 652) % 16;
                    if (b < 2) {
                        combo = e1;
                    } else if (b < 14) {
                        combo = "(⊙ω⊙)";
                    } else {
                        // This emoji actually varies depends on the judge of the note
                        // If it is perfect then it displays ○(≧▽≦)○
                        // Since this player doesn't support other types of judge,
                        // we always use this emoji.
                        combo = "Ｏ(≧▽≦)Ｏ";
                    }
                }
            }
            
            ctx.fillText(combo, cw / 2, 60 * ratio);
        }

        // -- Apf2023 debug
        if (this.performance == "apf2023" && this.renderDebug) {
            ctx.textAlign = "center";
            ctx.font = `500 ${22 * ratio}px ` + Assets.preferredFont;
            ctx.fillText(Math.floor(beat), cw / 2, 115 * ratio);
        }

        // -- Score
        ctx.textAlign = "right";
        ctx.font = `${36 * ratio}px ` + Assets.preferredFont;
        ctx.fillText(scoreStr, cw - pad - 30 * ratio, 55 * ratio);

        // -- FPS
        if(this.renderDebug) {
            ctx.textAlign = "center";
            ctx.font = `${28 * ratio}px ` + Assets.preferredFont;
            ctx.fillText("FPS: " + Math.round(10000 / this.deltaTime) / 10, cw / 2, ch - 10 * ratio);

            let lw = ctx.lineWidth;
            let alpha = ctx.globalAlpha;

            ctx.globalAlpha = 0.5;
            ctx.lineWidth = 3 * this.ratio;
            ctx.fillStyle = "#fff";
            ctx.strokeStyle = "#fff";
            ctx.font = `${20 * ratio}px ` + Assets.preferredFont;
            ctx.textBaseline = "middle";

            let radius = 50;

            this.touches.forEach(t => {
                ctx.beginPath();
                ctx.arc(t.xPos, t.yPos, radius * this.ratio, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillText(t.id, t.xPos, t.yPos - (radius + 25) * this.ratio)
            });

            ctx.lineWidth = lw;
            ctx.globalAlpha = alpha;
        }
    }
}