function x(){}const K=t=>t;function ft(t,e){for(const n in e)t[n]=e[n];return t}function Q(t){return t()}function G(){return Object.create(null)}function v(t){t.forEach(Q)}function O(t){return typeof t=="function"}function Tt(t,e){return t!=t?e==e:t!==e||t&&typeof t=="object"||typeof t=="function"}function dt(t){return Object.keys(t).length===0}function _t(t,...e){if(t==null)return x;const n=t.subscribe(...e);return n.unsubscribe?()=>n.unsubscribe():n}function Ot(t,e,n){t.$$.on_destroy.push(_t(e,n))}function qt(t,e,n,r){if(t){const s=U(t,e,n,r);return t[0](s)}}function U(t,e,n,r){return t[1]&&r?ft(n.ctx.slice(),t[1](r(e))):n.ctx}function Lt(t,e,n,r){if(t[2]&&r){const s=t[2](r(n));if(e.dirty===void 0)return s;if(typeof s=="object"){const l=[],i=Math.max(e.dirty.length,s.length);for(let o=0;o<i;o+=1)l[o]=e.dirty[o]|s[o];return l}return e.dirty|s}return e.dirty}function zt(t,e,n,r,s,l){if(s){const i=U(e,n,r,l);t.p(i,s)}}function Bt(t){if(t.ctx.length>32){const e=[],n=t.ctx.length/32;for(let r=0;r<n;r++)e[r]=-1;return e}return-1}function Ft(t){const e={};for(const n in t)n[0]!=="$"&&(e[n]=t[n]);return e}function Ht(t){return t&&O(t.destroy)?t.destroy:x}const V=typeof window!="undefined";let X=V?()=>window.performance.now():()=>Date.now(),I=V?t=>requestAnimationFrame(t):x;const w=new Set;function Y(t){w.forEach(e=>{e.c(t)||(w.delete(e),e.f())}),w.size!==0&&I(Y)}function Z(t){let e;return w.size===0&&I(Y),{promise:new Promise(n=>{w.add(e={c:t,f:n})}),abort(){w.delete(e)}}}let q=!1;function ht(){q=!0}function mt(){q=!1}function pt(t,e,n,r){for(;t<e;){const s=t+(e-t>>1);n(s)<=r?t=s+1:e=s}return t}function yt(t){if(t.hydrate_init)return;t.hydrate_init=!0;let e=t.childNodes;if(t.nodeName==="HEAD"){const c=[];for(let u=0;u<e.length;u++){const d=e[u];d.claim_order!==void 0&&c.push(d)}e=c}const n=new Int32Array(e.length+1),r=new Int32Array(e.length);n[0]=-1;let s=0;for(let c=0;c<e.length;c++){const u=e[c].claim_order,d=(s>0&&e[n[s]].claim_order<=u?s+1:pt(1,s,a=>e[n[a]].claim_order,u))-1;r[c]=n[d]+1;const f=d+1;n[f]=c,s=Math.max(f,s)}const l=[],i=[];let o=e.length-1;for(let c=n[s]+1;c!=0;c=r[c-1]){for(l.push(e[c-1]);o>=c;o--)i.push(e[o]);o--}for(;o>=0;o--)i.push(e[o]);l.reverse(),i.sort((c,u)=>c.claim_order-u.claim_order);for(let c=0,u=0;c<i.length;c++){for(;u<l.length&&i[c].claim_order>=l[u].claim_order;)u++;const d=u<l.length?l[u]:null;t.insertBefore(i[c],d)}}function gt(t,e){t.appendChild(e)}function tt(t){if(!t)return document;const e=t.getRootNode?t.getRootNode():t.ownerDocument;return e&&e.host?e:t.ownerDocument}function bt(t){const e=et("style");return $t(tt(t),e),e.sheet}function $t(t,e){gt(t.head||t,e)}function xt(t,e){if(q){for(yt(t),(t.actual_end_child===void 0||t.actual_end_child!==null&&t.actual_end_child.parentElement!==t)&&(t.actual_end_child=t.firstChild);t.actual_end_child!==null&&t.actual_end_child.claim_order===void 0;)t.actual_end_child=t.actual_end_child.nextSibling;e!==t.actual_end_child?(e.claim_order!==void 0||e.parentNode!==t)&&t.insertBefore(e,t.actual_end_child):t.actual_end_child=e.nextSibling}else(e.parentNode!==t||e.nextSibling!==null)&&t.appendChild(e)}function It(t,e,n){q&&!n?xt(t,e):(e.parentNode!==t||e.nextSibling!=n)&&t.insertBefore(e,n||null)}function wt(t){t.parentNode.removeChild(t)}function Wt(t,e){for(let n=0;n<t.length;n+=1)t[n]&&t[n].d(e)}function et(t){return document.createElement(t)}function vt(t){return document.createElementNS("http://www.w3.org/2000/svg",t)}function W(t){return document.createTextNode(t)}function Gt(){return W(" ")}function Jt(){return W("")}function Kt(t,e,n,r){return t.addEventListener(e,n,r),()=>t.removeEventListener(e,n,r)}function Qt(t,e,n){n==null?t.removeAttribute(e):t.getAttribute(e)!==n&&t.setAttribute(e,n)}function Et(t){return Array.from(t.childNodes)}function kt(t){t.claim_info===void 0&&(t.claim_info={last_index:0,total_claimed:0})}function nt(t,e,n,r,s=!1){kt(t);const l=(()=>{for(let i=t.claim_info.last_index;i<t.length;i++){const o=t[i];if(e(o)){const c=n(o);return c===void 0?t.splice(i,1):t[i]=c,s||(t.claim_info.last_index=i),o}}for(let i=t.claim_info.last_index-1;i>=0;i--){const o=t[i];if(e(o)){const c=n(o);return c===void 0?t.splice(i,1):t[i]=c,s?c===void 0&&t.claim_info.last_index--:t.claim_info.last_index=i,o}}return r()})();return l.claim_order=t.claim_info.total_claimed,t.claim_info.total_claimed+=1,l}function it(t,e,n,r){return nt(t,s=>s.nodeName===e,s=>{const l=[];for(let i=0;i<s.attributes.length;i++){const o=s.attributes[i];n[o.name]||l.push(o.name)}l.forEach(i=>s.removeAttribute(i))},()=>r(e))}function Ut(t,e,n){return it(t,e,n,et)}function Vt(t,e,n){return it(t,e,n,vt)}function At(t,e){return nt(t,n=>n.nodeType===3,n=>{const r=""+e;if(n.data.startsWith(r)){if(n.data.length!==r.length)return n.splitText(r.length)}else n.data=r},()=>W(e),!0)}function Xt(t){return At(t," ")}function Yt(t,e){e=""+e,t.wholeText!==e&&(t.data=e)}function Zt(t,e,n,r){n===null?t.style.removeProperty(e):t.style.setProperty(e,n,r?"important":"")}function te(t,e,n){t.classList[n?"add":"remove"](e)}function rt(t,e,{bubbles:n=!1,cancelable:r=!1}={}){const s=document.createEvent("CustomEvent");return s.initCustomEvent(t,n,r,e),s}function ee(t,e=document.body){return Array.from(e.querySelectorAll(t))}const R=new Map;let T=0;function Nt(t){let e=5381,n=t.length;for(;n--;)e=(e<<5)-e^t.charCodeAt(n);return e>>>0}function St(t,e){const n={stylesheet:bt(e),rules:{}};return R.set(t,n),n}function z(t,e,n,r,s,l,i,o=0){const c=16.666/r;let u=`{
`;for(let m=0;m<=1;m+=c){const g=e+(n-e)*l(m);u+=m*100+`%{${i(g,1-g)}}
`}const d=u+`100% {${i(n,1-n)}}
}`,f=`__svelte_${Nt(d)}_${o}`,a=tt(t),{stylesheet:h,rules:_}=R.get(a)||St(a,t);_[f]||(_[f]=!0,h.insertRule(`@keyframes ${f} ${d}`,h.cssRules.length));const p=t.style.animation||"";return t.style.animation=`${p?`${p}, `:""}${f} ${r}ms linear ${s}ms 1 both`,T+=1,f}function B(t,e){const n=(t.style.animation||"").split(", "),r=n.filter(e?l=>l.indexOf(e)<0:l=>l.indexOf("__svelte")===-1),s=n.length-r.length;s&&(t.style.animation=r.join(", "),T-=s,T||jt())}function jt(){I(()=>{T||(R.forEach(t=>{const{stylesheet:e}=t;let n=e.cssRules.length;for(;n--;)e.deleteRule(n);t.rules={}}),R.clear())})}let S;function A(t){S=t}function C(){if(!S)throw new Error("Function called outside component initialization");return S}function ne(t){C().$$.on_mount.push(t)}function ie(t){C().$$.after_update.push(t)}function re(t){C().$$.on_destroy.push(t)}function se(){const t=C();return(e,n,{cancelable:r=!1}={})=>{const s=t.$$.callbacks[e];if(s){const l=rt(e,n,{cancelable:r});return s.slice().forEach(i=>{i.call(t,l)}),!l.defaultPrevented}return!0}}function ce(t,e){return C().$$.context.set(t,e),e}function le(t,e){const n=t.$$.callbacks[e.type];n&&n.slice().forEach(r=>r.call(this,e))}const k=[],J=[],D=[],F=[],st=Promise.resolve();let H=!1;function ct(){H||(H=!0,st.then(lt))}function oe(){return ct(),st}function j(t){D.push(t)}function ue(t){F.push(t)}const L=new Set;let M=0;function lt(){const t=S;do{for(;M<k.length;){const e=k[M];M++,A(e),Ct(e.$$)}for(A(null),k.length=0,M=0;J.length;)J.pop()();for(let e=0;e<D.length;e+=1){const n=D[e];L.has(n)||(L.add(n),n())}D.length=0}while(k.length);for(;F.length;)F.pop()();H=!1,L.clear(),A(t)}function Ct(t){if(t.fragment!==null){t.update(),v(t.before_update);const e=t.dirty;t.dirty=[-1],t.fragment&&t.fragment.p(t.ctx,e),t.after_update.forEach(j)}}let E;function ot(){return E||(E=Promise.resolve(),E.then(()=>{E=null})),E}function N(t,e,n){t.dispatchEvent(rt(`${e?"intro":"outro"}${n}`))}const P=new Set;let y;function ae(){y={r:0,c:[],p:y}}function fe(){y.r||v(y.c),y=y.p}function Mt(t,e){t&&t.i&&(P.delete(t),t.i(e))}function de(t,e,n,r){if(t&&t.o){if(P.has(t))return;P.add(t),y.c.push(()=>{P.delete(t),r&&(n&&t.d(1),r())}),t.o(e)}}const ut={duration:0};function _e(t,e,n){let r=e(t,n),s=!1,l,i,o=0;function c(){l&&B(t,l)}function u(){const{delay:f=0,duration:a=300,easing:h=K,tick:_=x,css:p}=r||ut;p&&(l=z(t,0,1,a,f,h,p,o++)),_(0,1);const m=X()+f,g=m+a;i&&i.abort(),s=!0,j(()=>N(t,!0,"start")),i=Z(b=>{if(s){if(b>=g)return _(1,0),N(t,!0,"end"),c(),s=!1;if(b>=m){const $=h((b-m)/a);_($,1-$)}}return s})}let d=!1;return{start(){d||(d=!0,B(t),O(r)?(r=r(),ot().then(u)):u())},invalidate(){d=!1},end(){s&&(c(),s=!1)}}}function he(t,e,n,r){let s=e(t,n),l=r?0:1,i=null,o=null,c=null;function u(){c&&B(t,c)}function d(a,h){const _=a.b-l;return h*=Math.abs(_),{a:l,b:a.b,d:_,duration:h,start:a.start,end:a.start+h,group:a.group}}function f(a){const{delay:h=0,duration:_=300,easing:p=K,tick:m=x,css:g}=s||ut,b={start:X()+h,b:a};a||(b.group=y,y.r+=1),i||o?o=b:(g&&(u(),c=z(t,l,a,_,h,p,g)),a&&m(0,1),i=d(b,_),j(()=>N(t,a,"start")),Z($=>{if(o&&$>o.start&&(i=d(o,_),o=null,N(t,i.b,"start"),g&&(u(),c=z(t,l,i.b,i.duration,0,p,s.css))),i){if($>=i.end)m(l=i.b,1-l),N(t,i.b,"end"),o||(i.b?u():--i.group.r||v(i.group.c)),i=null;else if($>=i.start){const at=$-i.start;l=i.a+i.d*p(at/i.duration),m(l,1-l)}}return!!(i||o)}))}return{run(a){O(s)?ot().then(()=>{s=s(),f(a)}):f(a)},end(){u(),i=o=null}}}const me=typeof window!="undefined"?window:typeof globalThis!="undefined"?globalThis:global;function pe(t,e){const n={},r={},s={$$scope:1};let l=t.length;for(;l--;){const i=t[l],o=e[l];if(o){for(const c in i)c in o||(r[c]=1);for(const c in o)s[c]||(n[c]=o[c],s[c]=1);t[l]=o}else for(const c in i)s[c]=1}for(const i in r)i in n||(n[i]=void 0);return n}function ye(t){return typeof t=="object"&&t!==null?t:{}}function ge(t,e,n){const r=t.$$.props[e];r!==void 0&&(t.$$.bound[r]=n,n(t.$$.ctx[r]))}function be(t){t&&t.c()}function $e(t,e){t&&t.l(e)}function Dt(t,e,n,r){const{fragment:s,on_mount:l,on_destroy:i,after_update:o}=t.$$;s&&s.m(e,n),r||j(()=>{const c=l.map(Q).filter(O);i?i.push(...c):v(c),t.$$.on_mount=[]}),o.forEach(j)}function Pt(t,e){const n=t.$$;n.fragment!==null&&(v(n.on_destroy),n.fragment&&n.fragment.d(e),n.on_destroy=n.fragment=null,n.ctx=[])}function Rt(t,e){t.$$.dirty[0]===-1&&(k.push(t),ct(),t.$$.dirty.fill(0)),t.$$.dirty[e/31|0]|=1<<e%31}function xe(t,e,n,r,s,l,i,o=[-1]){const c=S;A(t);const u=t.$$={fragment:null,ctx:null,props:l,update:x,not_equal:s,bound:G(),on_mount:[],on_destroy:[],on_disconnect:[],before_update:[],after_update:[],context:new Map(e.context||(c?c.$$.context:[])),callbacks:G(),dirty:o,skip_bound:!1,root:e.target||c.$$.root};i&&i(u.root);let d=!1;if(u.ctx=n?n(t,e.props||{},(f,a,...h)=>{const _=h.length?h[0]:a;return u.ctx&&s(u.ctx[f],u.ctx[f]=_)&&(!u.skip_bound&&u.bound[f]&&u.bound[f](_),d&&Rt(t,f)),a}):[],u.update(),d=!0,v(u.before_update),u.fragment=r?r(u.ctx):!1,e.target){if(e.hydrate){ht();const f=Et(e.target);u.fragment&&u.fragment.l(f),f.forEach(wt)}else u.fragment&&u.fragment.c();e.intro&&Mt(t.$$.fragment),Dt(t,e.target,e.anchor,e.customElement),mt(),lt()}A(c)}class we{$destroy(){Pt(this,1),this.$destroy=x}$on(e,n){const r=this.$$.callbacks[e]||(this.$$.callbacks[e]=[]);return r.push(n),()=>{const s=r.indexOf(n);s!==-1&&r.splice(s,1)}}$set(e){this.$$set&&!dt(e)&&(this.$$.skip_bound=!0,this.$$set(e),this.$$.skip_bound=!1)}}export{_e as $,ye as A,Pt as B,ft as C,oe as D,x as E,qt as F,ee as G,xt as H,zt as I,Bt as J,Lt as K,vt as L,Vt as M,Kt as N,X as O,Z as P,Ot as Q,j as R,we as S,Ft as T,le as U,se as V,J as W,K as X,he as Y,Wt as Z,re as _,Et as a,ge as a0,te as a1,ue as a2,Ht as a3,v as a4,me as a5,Qt as b,Ut as c,wt as d,et as e,Zt as f,It as g,At as h,xe as i,Yt as j,Gt as k,Jt as l,Xt as m,ae as n,de as o,fe as p,Mt as q,ce as r,Tt as s,W as t,ie as u,ne as v,be as w,$e as x,Dt as y,pe as z};
