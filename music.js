// Original 6/8 miniature for plucked strings, wooden keys and celesta.
window.startDungeonAudio = function ({context, scene, setEffects}) {
  const bars = [
    // Bass, chord tones, melody (onset in eighth notes, pitch, length).
    [50,[62,65,69],[[0,74,1.7],[2,77,.7],[3,76,1],[4,74,.8],[5,69,.8]]],
    [43,[62,67,70],[[0,70,2.5],[3,67,1.5],[5,69,.7]]],
    [45,[61,64,69],[[0,73,.8],[1,76,.8],[2,79,.7],[3,81,2.4]]],
    [50,[62,65,69],[[0,77,1.6],[2,76,.7],[3,74,2]]],
    [46,[62,65,70],[[1,77,.8],[2,81,.7],[3,82,1.7],[5,81,.7]]],
    [41,[60,65,69],[[0,79,1.5],[2,77,.8],[3,72,2.4]]],
    [43,[62,67,70],[[0,74,.7],[1,70,.8],[2,67,.7],[4,70,1.4]]],
    [45,[61,64,69],[[0,73,2.2],[4,69,.7],[5,73,.75]]],
    [50,[62,65,69],[[0,74,1.7],[2,77,.8],[3,81,2.3]]],
    [48,[60,64,67],[[0,79,1.6],[2,76,.7],[3,72,2]]],
    [46,[62,65,70],[[0,70,.8],[1,74,.8],[2,77,.7],[3,82,1.8]]],
    [45,[61,64,69],[[0,81,2.4],[4,76,1.5]]],
    [43,[62,67,70],[[0,79,1.6],[2,77,.7],[3,74,1.6],[5,70,.8]]],
    [46,[62,65,70],[[0,77,2.1],[3,74,1],[5,70,.75]]],
    [45,[61,64,69],[[0,69,1],[2,73,.8],[3,76,1],[4,73,1.5]]],
    [50,[62,65,69],[[0,74,3.6],[5,69,.65]]]
  ];
  const saved=key=>{try{return localStorage.getItem(key)!=='off'}catch{return true}};
  const store=(key,on)=>{try{localStorage.setItem(key,on?'on':'off')}catch{}};
  const panel=document.querySelector('#audioPanel'), music=panel.querySelector('#musicOn'), effects=panel.querySelector('#effectsOn');
  music.checked=saved('dck-music');effects.checked=saved('dck-effects');setEffects(effects.checked);
  let ctx,bus,timer=null,next=0,pulse=0,activated=false;
  function note(pitch,time,length,volume,type,multiple=1){
    const voice=ctx.createOscillator(), envelope=ctx.createGain();
    voice.type=type;voice.frequency.value=440*2**((pitch-69)/12)*multiple;
    envelope.gain.setValueAtTime(.00001,time);
    envelope.gain.exponentialRampToValueAtTime(volume,time+.012);
    envelope.gain.exponentialRampToValueAtTime(.00001,time+length);
    voice.connect(envelope);envelope.connect(bus);voice.start(time);voice.stop(time+length+.01);
    voice.onended=()=>{voice.disconnect();envelope.disconnect()};
  }
  function schedule(){
    if(ctx.state!=='running'||!bus)return;
    next=Math.max(next,ctx.currentTime+.012);
    while(next<ctx.currentTime+.18){
      const setting=scene(),hall=setting==='hall',fight=setting==='fight';
      const beat=hall?.32:fight?.224:.268;
      const [bass,chord,melody]=bars[Math.floor(pulse/6)],i=pulse%6;
      if(i===0||i===3)note(i===0?bass:bass+7,next,beat*(hall?3:2),.065,'triangle');
      if(i===1||i===4||(!hall&&i===5)){
        note(chord[i===1?0:i===4?1:2],next,beat*1.25,.042,'triangle');
      }
      for(const [on,pitch,length] of melody)if(i===on){
        note(pitch,next,beat*length+.13,.115,'sine');
        note(pitch,next,.11,.033,'sine',3);
        if(hall||pulse%12===0)note(pitch+12,next+.014,.34,.023,'sine');
      }
      if(fight&&i%3===2)note(bass+12,next,.085,.045,'triangle');
      pulse=(pulse+1)%(bars.length*6);next+=beat;
    }
  }
  function stop(){
    clearInterval(timer);timer=null;
    if(bus){const old=bus;bus=null;old.gain.setTargetAtTime(0,ctx.currentTime,.014);setTimeout(()=>old.disconnect(),100)}
  }
  function play(){
    if(!activated||!music.checked||document.hidden||timer!==null)return;
    try{
      ctx=context();if(!ctx)return;
      if(ctx.state!=='running')ctx.resume().catch(()=>{});
      bus=ctx.createGain();bus.gain.value=.26;bus.connect(ctx.destination);
      next=ctx.currentTime+.05;schedule();timer=setInterval(schedule,60);
    }catch{stop()}
  }
  function gesture(){
    activated=true;
    if(ctx&&music.checked&&ctx.state!=='running')ctx.resume().catch(()=>{});
    play();
  }
  for(const event of ['click','touchend','keydown'])document.addEventListener(event,gesture,{capture:true,passive:true});
  music.onchange=()=>{store('dck-music',music.checked);music.checked?play():stop()};
  effects.onchange=()=>{store('dck-effects',effects.checked);setEffects(effects.checked)};
  document.querySelector('#soundBtn').onclick=()=>panel.showModal();
  panel.querySelector('button').onclick=()=>panel.close();
  document.addEventListener('visibilitychange',()=>document.hidden?stop():play());
  window.addEventListener('pagehide',stop);window.addEventListener('pageshow',play);
};
