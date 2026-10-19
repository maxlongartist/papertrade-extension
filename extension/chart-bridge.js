// Read-only native chart geometry. No network, trading controls or wallet access.
// MAIN world is required because canvas draw calls originate in the page world.
const original=CanvasRenderingContext2D.prototype.fillText;
const pending=new WeakMap();
const enabled=()=>['data-paperpilot-chart-enabled','data-paperpilot-analysis-enabled'].some(key=>document.documentElement?.getAttribute(key)==='true');
CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){
  const result=Reflect.apply(original,this,[text,x,y,...rest]);
  try{
    if(!enabled()||this.canvas.id!=='cv'||!this.canvas.closest('#chart'))return result;
    const label=String(text).trim(),price=this.textAlign==='left'&&this.textBaseline==='middle'&&/^\d[\d,]*(\.\d+)?$/.test(label),time=this.textAlign==='center'&&this.textBaseline==='alphabetic'&&/^\d{2}:\d{2}(:\d{2})?$/.test(label);if(!price&&!time)return result;
    let frame=pending.get(this.canvas);
    if(!frame){frame={points:[],times:[]};pending.set(this.canvas,frame);const canvas=this.canvas;
      queueMicrotask(()=>{pending.delete(canvas);if(!enabled())return;const r=canvas.getBoundingClientRect();if(r.width<20||r.height<20)return;canvas.setAttribute('data-paperpilot-axis',JSON.stringify({width:r.width,height:r.height,route:location.pathname,at:Date.now(),points:frame.points.slice(-100),times:frame.times.slice(-100)}));});
    }
    const m=this.getTransform(),r=this.canvas.getBoundingClientRect();
    (price?frame.points:frame.times).push({...(price?{price:Number(label.replaceAll(',',''))}:{label}),x:(m.a*x+m.c*y+m.e)*r.width/this.canvas.width,y:(m.b*x+m.d*y+m.f)*r.height/this.canvas.height});
  }catch{/* Display-only observer must never interfere with native painting. */}
  return result;
};
