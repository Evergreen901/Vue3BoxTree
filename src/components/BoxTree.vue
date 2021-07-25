<template>
  <div id="tree-container"></div>
</template>

<script>
import * as d3 from 'd3'
import $ from 'jquery'
import _ from 'underscore'

let selectedNode = null;
let draggingNode = null;  
let viewerWidth,viewerHeight;
const ANIMATION_DELAY = 750;
const COLOR_WHITE = '#ffff';

export default {
  name: 'BoxTree',
  components: {},
  data () {
    return {
      rootNode : {}
    }
  },
  mounted () {
    viewerWidth = $(document).width()-20;
    viewerHeight = $(document).height()-20;
    let $this = this;
    this.rootNode = this.$props.data;
    this.tree = d3.layout.tree()
        .size([viewerHeight, viewerWidth]);

    // define the zoomListener which calls the zoom function on the "zoom" event constrained within the scaleExtents
    this.zoomListener = d3.behavior.zoom().scaleExtent([0.1, 2]).on("zoom", this.zoom);

    // define the baseSvg, attaching a class for styling and the zoomListener
    this.baseSvg = d3.select("#tree-container").append("svg")
        .attr("width", viewerWidth)
        .attr("height", viewerHeight)
        .attr("class", "overlay")
        .call(this.zoomListener);

    // Define the drag listeners for drag/drop behaviour of nodes.
    this.dragListener = d3.behavior.drag()
        .on("dragstart", function(d) {
          if (d == this.rootNode) {
            return;
          }
          $this.dragStarted = true;
          $this.nodes = $this.tree.nodes(d);
          d3.event.sourceEvent.stopPropagation();
          // it's important that we suppress the mouseover event on the node being dragged. Otherwise it will absorb the mouseover event and the underlying node will not detect it d3.select(this).attr('pointer-events', 'none');
        })
        .on("drag", function(d) {
          if (d == $this.rootNode) {
            return;
          }
          if ($this.dragStarted) {
            $this.domNode = this;
            $this.initiateDrag(d, $this.domNode);
          }

          // get coords of mouseEvent relative to svg container to allow for panning
          $this.relCoords = d3.mouse($('svg').get(0));
          if ($this.relCoords[0] < $this.panBoundary) {
            $this.panTimer = true;
            $this.pan(this, 'left');
          } else if ($this.relCoords[0] > ($('svg').width() - $this.panBoundary)) {
            $this.panTimer = true;
            $this.pan(this, 'right');
          } else if ($this.relCoords[1] < $this.panBoundary) {
            $this.panTimer = true;
            $this.pan(this, 'up');
          } else if ($this.relCoords[1] > ($('svg').height() - $this.panBoundary)) {
            $this.panTimer = true;
            $this.pan(this, 'down');
          } else {
            try {
              clearTimeout($this.panTimer);
            } catch (e) {

            }
          }

          d.x0 += d3.event.dy;
          d.y0 += d3.event.dx;
          $this.node = d3.select(this);
          $this.node.attr("transform", "translate(" + d.y0 + "," + (d.x0-$this.$props.nodeHeight/2) + ")");
        }).on("dragend", function(d) {
          if (d == $this.rootNode) {
            return;
          }
          $this.domNode = this;
          if (selectedNode) {
            // now remove the element from the parent, and insert it into the new elements children
            var index = draggingNode.parent.children.indexOf(draggingNode);
            if (index > -1) {
              draggingNode.parent.children.splice(index, 1);
            }
            if (typeof selectedNode.children !== 'undefined' || typeof selectedNode._children !== 'undefined') {
              if (typeof selectedNode.children !== 'undefined') {
                selectedNode.children.push(draggingNode);
                selectedNode.highlighted = true;
              } else {
                if (selectedNode._children === null){
                  selectedNode.children = [];
                  selectedNode.children.push(draggingNode);
                  selectedNode.highlighted = true;
                }else{
                  selectedNode._children.push(draggingNode);
                  selectedNode.highlighted = true;
                }
              }
            } else {
              selectedNode.children = [];
              selectedNode.children.push(draggingNode);
              selectedNode.highlighted = true;
            }
            // Make sure that the node being added to is expanded so user can see added node is correctly moved
            $this.expand(selectedNode);
            $this.endDrag();
          } else {
            $this.endDrag();
          }
        });

    // Append a group which holds all nodes and which the zoom Listener can act upon.
    this.svgGroup = this.baseSvg.append("g");

    this.rootNode.x0 = 0;
    this.rootNode.y0 = 0;

    this.defs = this.baseSvg.append('defs');
    //initialize node's dropshadow.
    this.initDropShadow();
    this.update(this.rootNode);

    // bring selected one to front.
    d3.selectAll('g.node').on('click', function() {
      if (this !== d3.select('g.node:last-child').node()) {        
        this.parentElement.appendChild(this);
      }
    });
  },
  methods : {
    //callback, add node, parentId=clicked node's id
    addNode(parentId,newTitle,newDetail){
      let newId = this.generateUUID();
      let newNode = {
        'name': newTitle,
        'id' :  newId,
        'detail' : newDetail,
        'children': [],
        '_children':null
      };
      let $this = this;
      this.nodes.forEach(function(ch) {
        if (ch.id != parentId) return;
        if (ch.children == undefined) 
          ch.children = [];
        ch.children.push(newNode);
        $this.update($this.rootNode);
      });
    },
    editNode(nodeId,newTitle,newDetail){
      let $this = this;
      this.nodes.forEach(function(ch) {
        if (ch.id != nodeId) return;
        ch.name = newTitle;
        ch.detail = newDetail;
        $this.update($this.rootNode);
      });
      
      $('#'+nodeId+'_detail').html(newDetail);
      $('#'+nodeId+'_name').html(newTitle);

    },
    deleteNode(nodeId){
      if (nodeId == this.rootNode.id){
        return false;
      }
      let $this = this;
      this.nodes.forEach(function(ch) {
        if (ch.id != nodeId) return;
        ch.parent.children = _.without(ch.parent.children, ch);
        $this.update($this.rootNode);
      });      
    },
    //callback
    //return rootNode state
    getTreeData(){
      let resultData = {
      };
      let getData = function (data, node) {
        data.id = node.id;
        data.name = node.name;
        data.detail = node.detail;
        data.children = [];

        if (node.children && node.children.length > 0) {
          node.children.forEach(function(ch) {
            data.children.push({});
            getData(data.children[data.children.length - 1], ch);
          });
        }
      };
      getData(resultData, this.rootNode);
      return resultData;
    },
    //when add button clicked, this will call
    generateUUID(){
      let d = new Date().getTime();
      let uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        let r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
      });
      return uuid;
    },
    diagonal(d) {
      let p0 = {
        x : d.source.x - this.$props.nodeHeight / 2 + 16,
        y : (d.source.y + this.$props.nodeWidth)
      }, p3 = {
        x : d.target.x - this.$props.nodeHeight / 2 + 16,
        y : d.target.y  // -12, so the end arrows are just before the rect node
      }, m = (p0.y + p3.y) / 2, p = [ p0, {
        x : p0.x,
        y : m
      }, {
        x : p3.x,
        y : m
      }, p3 ];
      p = p.map(function(d) {
        return [ d.y , d.x ];
      });
      return 'M' + p[0] + 'C' + p[1] + ' ' + p[2] + ' ' + p[3];
    },    
    pan(domNode, direction) {
      let speed = this.panSpeed;
      if (this.panTimer) {
        clearTimeout(this.panTimer);
        let translateCoords;
        translateCoords = d3.transform(this.svgGroup.attr("transform"));
        let translateX,translateY,scaleX,scaleY,panTimer;
        if (direction === 'left' || direction === 'right') {
          translateX = direction === 'left' ? translateCoords.translate[0] + speed : translateCoords.translate[0] - speed;
          translateY = translateCoords.translate[1];
        } else if (direction === 'up' || direction === 'down') {
          translateX = translateCoords.translate[0];
          translateY = direction === 'up' ? translateCoords.translate[1] + speed : translateCoords.translate[1] - speed;
        }
        scaleX = translateCoords.scale[0];
        scaleY = translateCoords.scale[1];
        this.scale = this.zoomListener.scale();
        this.svgGroup.transition().attr("transform", "translate(" + translateX + "," + translateY + ")scale(" + this.scale + ")");
        d3.select(domNode).select('g.node').attr("transform", "translate(" + translateX + "," + translateY + ")");
        this.zoomListener.scale(this.zoomListener.scale());
        this.zoomListener.translate([translateX, translateY]);
        panTimer = setTimeout(function() {
          this.pan(domNode, speed, direction);
        }, 50);
      }
    },

    // Define the zoom function for the zoomable tree
    zoom() {
      this.svgGroup.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
    },

    initDropShadow() {
      let filter = this.defs.append("filter")
          .attr("id", "drop-shadow")
          .attr("color-interpolation-filters", "sRGB");
      filter.append("feOffset")
          .attr("result", "offOut")
          .attr("in", "SourceGraphic")
          .attr("dx", 0)
          .attr("dy", 0);

      filter.append("feGaussianBlur")
          .attr("stdDeviation", 2);

      filter.append("feOffset")
          .attr("dx", 2)
          .attr("dy", 2)
          .attr("result", "shadow");

      filter.append("feComposite")
          .attr("in", 'offOut')
          .attr("in2", 'shadow')
          .attr("operator", "over");
    },

    initiateDrag(d, domNode) {
      let $this = this;
      draggingNode = d;
      d3.select(domNode).select('.ghostCircle').attr('pointer-events', 'none');
      d3.selectAll('.ghostCircle').attr('class', 'ghostCircle show');
      d3.select(domNode).attr('class', 'node activeDrag');

      this.svgGroup.selectAll("g.node").sort(function(a, b) { // select the parent and sort the path's
        if (a.id != draggingNode.id) return 1; // a is not the hovered element, send "a" to the back
        else return -1; // a is the hovered element, bring "a" to the front
      });
      // if nodes has children, remove the links and nodes
      if (this.nodes.length > 1) {
        // remove link paths
        let links,nodePaths,nodesExit
        links = this.tree.links(this.nodes);
        nodePaths = this.svgGroup.selectAll("path.link")
            .data(links, function(d) {
              return d.target.id;
            }).remove();
        // remove child nodes
        nodesExit = this.svgGroup.selectAll("g.node")
            .data(this.nodes, function(d) {
              return d.id;
            }).filter(function(d, i) {
              if (d.id == draggingNode.id) {
                return false;
              }
              return true;
            }).remove();
      }

      // remove parent link
      this.parentLink = this.tree.links(this.tree.nodes(draggingNode.parent));
      this.svgGroup.selectAll('path.link').filter(function(d, i) {
        if (d.target.id == draggingNode.id) {
          return true;
        }
        return false;
      }).remove();

      this.dragStarted = null;
    },
    endDrag() {
      d3.selectAll('.ghostCircle').attr('class', 'ghostCircle');
      d3.select(this.domNode).attr('class', 'node');
      // now restore the mouseover event or we won't be able to drag a 2nd time
      d3.select(this.domNode).select('.ghostCircle').attr('pointer-events', '')
      if (draggingNode !== null) {
        this.update(this.rootNode);
        draggingNode = null;
      }
      selectedNode = null;
    },
    overCircle(d) {
      selectedNode = d;
      if (draggingNode !== null && selectedNode !== null) {
        $('#'+selectedNode.id+'_g').attr('class','drag start-opacity')
      }
    },
    outCircle(d) {
      $('#'+d.id+'_g').attr('class','drag end-opacity')
      selectedNode = null;
    },

    toggleChildren(d) {
      if (d.children) {
        d._children = d.children;
        d.children = null;
      } else if (d._children) {
        d.children = d._children;
        d._children = null;
      }
      return d;
    },
    
    
    // Toggle children on click.

    click(d) {
      if (d3.event.defaultPrevented) return; // click suppressed
      d = this.toggleChildren(d);
      this.update(d,true);
    },

    collapse(d) {
      if (d.children) {
        d._children = d.children;
        d._children.forEach(this.collapse);
        d.children = null;
      }
    },

    expand(d) {
      if (d._children) {
        d.children = d._children;
        d.children.forEach(this.expand);
        d._children = null;
      }
    },

    update(source,isCollapse) {
      let $this = this;
      
      // Caculate each node's leaves count. A leaf node means that it has no children.

      let leafCount = function(n) {
        if (n.children == undefined || n.children.length == 0) {
          n.leaves = 1;
          return;
        }

        let nCount = 0;
        n.children.forEach(function(ch) {
          leafCount(ch);
          nCount += ch.leaves;
        });
        n.leaves = nCount;
      };
      leafCount(this.rootNode);

      // Determine how many leaves are there above each node. A node's x-position depends on this value. (node.top)
      let calcTop = function(top, n) {
        if (n.children == undefined || n.children.length == 0) {
          n.top = top;
          return;
        }

        n.top = top;
        n.children.forEach(function(ch) {
          calcTop(top, ch);
          top += ch.leaves;
        });
      };
      calcTop(0, this.rootNode);
      
      let treeLeaves = this.rootNode.leaves;
      let newHeight = this.rootNode.leaves * (this.$props.nodeHeight + this.$props.marginY);
      this.tree = this.tree.size([newHeight, viewerWidth]);

      // Compute the new tree layout.
      this.nodes = this.tree.nodes(this.rootNode).reverse();
      this.links = this.tree.links(this.nodes);

      // Set coordinate of each node according to its depth & leaves.
      this.nodes.forEach(function(d) {
        d.y = d.depth * ($this.$props.nodeWidth + $this.$props.marginX);
        d.x = (d.top / treeLeaves) * newHeight + 150;
      });

      // Update the nodes…
      this.node = this.svgGroup.selectAll("g.node")
          .data(this.nodes, function(d) {
            return d.id || (d.id = ++$this.i);
          });

      // Enter any new nodes at the parent's previous position.
      let sourceX, sourceY;
      if (selectedNode == null) {
        sourceX = source.x0;
        sourceY = source.y0;
      } else {
        sourceX = selectedNode.x0;
        sourceY = selectedNode.y0;
      }

      let nodeEnter = this.node.enter().append("g")
          .call(this.dragListener)
          .attr("class", "node")
          .attr("transform", function(d) {
            return "translate(" + sourceY + "," + (sourceX - $this.$props.nodeHeight/2) + ")";
          });

      nodeEnter.append("rect")
          .attr('width', this.$props.nodeWidth)
          .attr('id',d=>{
            return d.id+'_g'
          })
          .style('stroke-width',1)
          .style('stroke','rgb(0,0,0)')
          .attr('height', this.$props.nodeHeight)
          .attr('rx', 6)
          .attr('ry', 6)
          .attr('filter', 'url(#drop-shadow)')
          .style("fill", function(d) {
            return COLOR_WHITE;
          });
      window.Vue = this;

      let innerWidth = $this.$props.nodeWidth - $this.$props.textPadding * 2;
      let innerHeight = $this.$props.nodeHeight - $this.$props.textPadding * 2;
      nodeEnter.append('foreignObject')
          .attr('x', this.$props.textPadding)
          .attr('y', this.$props.textPadding)
          .attr('width', function() {
            return innerWidth < 0 ? 0 : innerWidth
          })
          .attr('height', function() {
            return innerHeight < 0 ? 0 : innerHeight
          })
          .attr('style',function(){
            return 'color:black;height:' + innerHeight;
          })
          .append('xhtml')
          .html(function(d) {
            return `<div style="width: 100%; height: 100%;" class="node-text wordwrap">
                <b><span class="title-text-flow disable-select" id="${d.id}_name">${d.name}</span></b>
                <button class="collapseBtn" onclick="
                $(this).parents('foreignobject').attr('height', 30);
                $(this).parent().parent().parent().prev().animate({height:30});
                $(this).parent().parent().parent().animate({height:30});$(this).hide();$(this).next().show();">&#8679;
                </button><button class="collapseBtnHidden" onclick="
                $(this).parents('foreignobject').attr('height', ${innerHeight});
                $(this).parent().parent().parent().prev().animate({height: ${$this.$props.nodeHeight}});
                $(this).parent().parent().parent().animate({height: ${innerHeight}});
                $(this).hide();$(this).prev().show()">&#8681;</button>
                <hr>
                <span class="cursor-pointer" onclick="Vue.$props.onAddBtnClicked('${d.id}')">追加</span>
                 | <span class="cursor-pointer" onclick="Vue.$props.onEditBtnClicked('${d.id}')">編集</span>
                 | <span class="cursor-pointer" onclick="Vue.$props.onDeleteBtnClicked('${d.id}')">削除</span>
                <hr>
                <span class="detail-text-flow disable-select" id="${d.id}_detail">${d.detail}</span><br>
              </div>`;
          })


      // phantom node to give us mouseover in a radius around it
      nodeEnter.append("circle")
          .attr('class', 'ghostCircle')
          .attr("r", 60)
          .attr("opacity", 0.2) // change this to zero to hide the target area
          .style("fill", "white")
          .attr('pointer-events', 'mouseover')
          .on("mouseover", function(node) {
            $this.overCircle(node);
          })
          .on("mouseout", function(node) {
            $this.outCircle(node);
          });
      nodeEnter.append("circle")
          .attr("class","collapse")
          .attr("r", 10)
          .style("fill", "steelblue")
          .attr("transform", function(d) {
            return "translate(" + $this.$props.nodeWidth + "," + 16 + ")";
          })
          .attr('x',100)
          .style('display',(d)=>{
            if (d.children  || d._children){
              return 'block';
            }else{
              return 'none';
            }
          });

      nodeEnter.append('text')
          .attr('class','collapse-text')
          .attr('x',this.$props.nodeWidth)
          .attr('dy','.3em')
          .style('fill','white')
          .attr('text-anchor','middle')
          .style('display',(d)=>{
            if (d.children  || d._children){
              return 'block';
            }else{
              return 'none';
            }
          })
          .style('cursor', 'pointer')
          .on('click', $this.click);


      // Update the text to reflect whether node has children or not.
      this.node.select('text')
          .attr("font-size", function(d) {
            if (d.children){
              return 'xxx-large';
            }else{
              return '';
            }
          })
          .attr("y", function(d) {
            if (d.children){
              return 15;
            }else{
              return 17;
            }
          })
          .text(function(d) {
            if (d.children){
              return '-';
            }else{
              return '+';
            }
          });
      this.node.select('.collapse')
          .style('display',(d)=>{
            if (d.children  || d._children){
              return 'block';
            }else{
              return 'none';
            }
          })
      this.node.select('.collapse-text')
          .style('display',(d)=>{
            if (d.children  || d._children){
              return 'block';
            }else{
              return 'none';
            }
          })


      // Change the circle fill depending on whether it has children and is collapsed
      this.node.select("circle.nodeCircle")
          .attr("r", 4.5)
          .style("fill", function(d) {
            return d._children ? "lightsteelblue" : "#fff";
          });

      // Transition nodes to their new position.
      let nodeUpdate = this.node.transition()
          .duration(ANIMATION_DELAY)
          .attr("transform", function(d) {
            return "translate(" + d.y + "," + (d.x-$this.$props.nodeHeight/2) + ")";
          });
      // Fade the text in
      nodeUpdate.select("text")
          .style("fill-opacity", 1);

      // Transition exiting nodes to the parent's new position.
      let nodeExit = $this.node.exit().transition()
          .duration(ANIMATION_DELAY)
          .attr("transform", function(d) {
            //console.log("translate(" + source.y + "," + (source.x-$this.$props.nodeHeight/2) + ")");
            return "translate(" + source.y + "," + (source.x-$this.$props.nodeHeight/2) + ")";
          })
          .remove();

      nodeExit.select("circle")
          .attr("r", 0);

      nodeExit.select("text")
          .style("fill-opacity", 0);

      // Update the links…
      let link = $this.svgGroup.selectAll("path.link")
          .data($this.links, function(d) {
            return d.target.id;
          });

      // Enter any new links at the parent's previous position.
      link.enter().insert("path", "g")
          .attr("class", "link")
          .attr("d", function(d) {
            var o = {
              x: sourceX,
              y: sourceY
            };
            return $this.diagonal({
              source: o,
              target: o
            });
          });

      // Transition links to their new position.
      link.transition()
          .duration(ANIMATION_DELAY)
          .attr("d", function(d) { return $this.diagonal(d); });

      // Transition exiting nodes to the parent's new position.
      link.exit().transition()
          .duration(ANIMATION_DELAY)
          .attr("d", function(d) {
            var o = {
              x: source.x,
              y: source.y
            };
            return $this.diagonal({
              source: o,
              target: o
            });
          })
          .remove();

      // Stash the old positions for transition.
      this.nodes.forEach(function(d) {
        d.x0 = d.x;
        d.y0 = d.y;
      });
      if (isCollapse === false){
        this.rootNode = source;
      }
    },

},
  props: ['data', 'onAddBtnClicked', 'onEditBtnClicked', 'onDeleteBtnClicked','nodeWidth','nodeHeight','textPadding', 'marginX', 'marginY']
}
</script>

<style>

.overlay{
  background-color:#EEE;
}

.title-text-flow{
  max-width: 70%;
  display: inline-block;
  overflow: hidden;
  /* line-height: 13px; */
  text-overflow: ellipsis;
  white-space: nowrap;
}
.detail-text-flow{
  max-width: 100%;
  line-break: anywhere;
  display: inline-block;
  overflow: hidden;
  /* line-height: 13px; */
  text-overflow: ellipsis;
}

.node circle {
  fill: #fff;
  stroke: steelblue;
  stroke-width: 1.5px;
}

.node text {
  font-size:33px;
  font-family:sans-serif;
}

.link {
  fill: none;
  stroke: #ccc;
  stroke-width: 1.5px;
}

.templink {
  fill: none;
  stroke: red;
  stroke-width: 3px;
}

.ghostCircle.show{
  display:block;
}

.collapseBtn{
  float: right;
  margin-right: 10px;
}
.collapseBtnHidden{
  float: right;
  margin-right: 10px;
  display: none;
}
.ghostCircle, .activeDrag .ghostCircle{
  display: none;
}
.cursor-pointer{
  cursor: pointer;
  /*color: blue;*/
}
.disable-select {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
.drag.end-opacity{
  opacity: 1;
  z-index: 999;
}
.drag.start-opacity{
  opacity:0.3;
  z-index: 1;
}
</style>
