// Read-only native chart geometry. No network, trading controls or wallet access.
// MAIN world is required because canvas draw calls originate in the page world.
const original=CanvasRenderingContext2D.prototype.fillText;
const pending=new WeakMap();
CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){
  const result=Reflect.apply(original,this,[text,x,y,...rest]);
  try{
    if(document.documentElement?.getAttribute('data-paperpilot-chart-enabled')!=='true'||this.canvas.id!=='cv'||!this.canvas.closest('#chart')||this.textAlign!=='left'||this.textBaseline!=='middle')return result;
    const label=String(text).trim();if(!/^\d[\d,]*(\.\d+)?$/.test(label))return result;
    let frame=pending.get(this.canvas);
    if(!frame){frame={points:[]};pending.set(this.canvas,frame);const canvas=this.canvas;
      queueMicrotask(()=>{pending.delete(canvas);if(document.documentElement?.getAttribute('data-paperpilot-chart-enabled')!=='true')return;const r=canvas.getBoundingClientRect();if(r.width<20||r.height<20)return;canvas.setAttribute('data-paperpilot-axis',JSON.stringify({width:r.width,height:r.height,route:location.pathname,at:Date.now(),points:frame.points.slice(-100)}));});
    }
    const m=this.getTransform(),r=this.canvas.getBoundingClientRect();
    frame.points.push({price:Number(label.replaceAll(',','')),x:(m.a*x+m.c*y+m.e)*r.width/this.canvas.width,y:(m.b*x+m.d*y+m.f)*r.height/this.canvas.height});
  }catch{/* Display-only observer must never interfere with native painting. */}
  return result;
};
