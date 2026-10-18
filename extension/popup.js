import {mountCongestion} from './congestion-panel.js';
import {mountOverview} from './popup-panel.js';
const dispose=mountOverview(document.querySelector('#app'),message=>chrome.runtime.sendMessage(message));
const queueHost=document.querySelector('#overviewQueue');const disposeQueue=mountCongestion(queueHost.attachShadow({mode:'closed'}),message=>chrome.runtime.sendMessage(message));
window.addEventListener('pagehide',()=>{dispose();disposeQueue();},{once:true});
