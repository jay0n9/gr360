/* ACN/SN3D W,Y,Z,X -> six world-fixed virtual speakers -> Web Audio HRTF.
 * This is a preview decoder, not a certified Ambisonics renderer.
 * For six cardinal speaker directions E=[1,left,up,front], D=E(E^T E)^-1:
 * D row = [1/6, left/2, up/2, front/2]. Therefore E^T D=I exactly.
 * Browser coordinates are right/up/back; FOA coordinates front/left/up.
 */
(() => {
  const directions = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]; // RUF
  function create(context, destination) {
    const input=context.createGain();input.channelCount=4;input.channelCountMode='explicit';input.channelInterpretation='discrete';
    const split=context.createChannelSplitter(4);input.connect(split);
    const speakers=directions.map(d=>{
      const p=new PannerNode(context,{panningModel:'HRTF',distanceModel:'inverse',refDistance:1,
        rolloffFactor:0,positionX:d[0],positionY:d[1],positionZ:-d[2],
        channelCount:1,channelCountMode:'explicit'});
      const coefficients=[1/6,-d[0]/2,d[1]/2,d[2]/2];
      const gains=coefficients.map((value,c)=>{const g=context.createGain();g.gain.value=value;split.connect(g,c);g.connect(p);return g;});
      p.connect(destination);return {direction:d,coefficients,panner:p,gains};
    });
    function orient(yaw,pitch){
      const a=yaw*Math.PI/180,b=pitch*Math.PI/180;
      const forward=[Math.sin(a)*Math.cos(b),Math.sin(b),-Math.cos(a)*Math.cos(b)];
      const up=[-Math.sin(a)*Math.sin(b),Math.cos(b),Math.cos(a)*Math.sin(b)];
      const listener=context.listener;
      if(listener.forwardX){
        ['X','Y','Z'].forEach((axis,i)=>{
          listener['forward'+axis].setValueAtTime(forward[i],context.currentTime);
          listener['up'+axis].setValueAtTime(up[i],context.currentTime);
        });
      }else listener.setOrientation(...forward,...up);
      return {forward,up};
    }
    orient(0,0);return {input,speakers,orient};
  }
  function readFloatWav(raw,context) {
    const view=new DataView(raw),text=(o,n)=>String.fromCharCode(...new Uint8Array(raw,o,n));
    if(text(0,4)!=='RIFF'||text(8,4)!=='WAVE')throw Error('Invalid spatial audio WAV');
    let fmt,data;
    for(let p=12;p+8<=raw.byteLength;){const n=view.getUint32(p+4,true),id=text(p,4),start=p+8;
      if(start+n>raw.byteLength)throw Error('The spatial audio file is truncated.');
      if(id==='fmt ')fmt={format:view.getUint16(start,true),channels:view.getUint16(start+2,true),rate:view.getUint32(start+4,true),bits:view.getUint16(start+14,true)};
      if(id==='data')data={start,size:n};p=start+n+(n%2);
    }
    if(!fmt||!data||fmt.format!==3||fmt.channels!==4||fmt.rate!==48000||fmt.bits!==32||data.size!==240000*16)throw Error('A 48 kHz, 5-second, four-channel float WAV is required.');
    // Explicit deinterleaving avoids any conventional speaker remapping by a media decoder.
    const buffer=context.createBuffer(4,240000,48000);
    for(let c=0;c<4;c++){const channel=buffer.getChannelData(c);for(let i=0;i<240000;i++){
      const x=view.getFloat32(data.start+i*16+c*4,true);if(!Number.isFinite(x))throw Error('Invalid spatial audio sample');channel[i]=x;}}
    return buffer;
  }
  window.FoaPreviewDecoder={create,readFloatWav,directions};
})();
