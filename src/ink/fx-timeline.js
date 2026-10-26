/* FLOW 05 — simulation-owned effect event scheduler.
 * Start/end edges are stable and exactly-once for a monotonically advancing
 * action instance. seek() is silent; cancel() closes every active emitter.
 * No render callback may advance a cursor or dispatch a gameplay event.
 */
'use strict';
(() => {
  class EventTimeline {
    constructor(events=[],{instance=0}={}) {
      if(!Array.isArray(events)||events.length>512)throw RangeError('Timeline supports 0..512 events');
      const ids=new Set();this.edges=[];this.active=new Map();this.instance=instance;
      for(const event of events) {
        if(!event||typeof event.id!=='string'||ids.has(event.id)||!Number.isFinite(event.frame)||event.frame<0||!Number.isFinite(event.duration)||event.duration<=0)throw TypeError('Unique valid timeline events required');
        ids.add(event.id);this.edges.push({frame:event.frame,kind:'start',event},{frame:event.frame+event.duration,kind:'end',event});
      }
      this.edges.sort((a,b)=>a.frame-b.frame||(a.kind==='end'?-1:1)-(b.kind==='end'?-1:1)||a.event.id.localeCompare(b.event.id));
      this.cursor=-1;this.index=0;this.closed=false;this.serial=0;
    }
    advance(frame,dispatch=()=>{}) {
      if(!Number.isFinite(frame)||frame<0)throw RangeError('Finite nonnegative timeline frame required');
      if(frame<this.cursor)throw RangeError('Use silent seek() for reverse timeline movement');
      if(this.closed)return [];
      const out=[];
      while(this.index<this.edges.length&&this.edges[this.index].frame<=frame) {
        const edge=this.edges[this.index++];
        if(edge.kind==='start')this.active.set(edge.event.id,edge.event);else this.active.delete(edge.event.id);
        const item={...edge,instance:this.instance,serial:++this.serial};out.push(item);dispatch(item);
      }
      this.cursor=frame;return out;
    }
    seek(frame) {
      if(!Number.isFinite(frame)||frame<0)throw RangeError('Finite nonnegative timeline frame required');
      this.index=0;this.cursor=-1;this.active.clear();this.closed=false;
      while(this.index<this.edges.length&&this.edges[this.index].frame<=frame) {
        const edge=this.edges[this.index++];if(edge.kind==='start')this.active.set(edge.event.id,edge.event);else this.active.delete(edge.event.id);
      }
      this.cursor=frame;return [...this.active.values()];
    }
    cancel(reason='cancelled') {
      if(this.closed)return [];this.closed=true;
      const out=[...this.active.values()].map(event=>({frame:this.cursor,kind:'cancel',event,reason,instance:this.instance,serial:++this.serial}));
      this.active.clear();return out;
    }
    snapshot() {return {instance:this.instance,cursor:this.cursor,index:this.index,closed:this.closed,serial:this.serial,active:[...this.active.keys()]};}
  }
  INK.EventTimeline=EventTimeline;
})();
