<template>
  <div class="container">
    <BoxTree v-if="jsonData" :data="jsonData" ref="boxTree" :nodeWidth="250" :nodeHeight="220" :textPadding="5" :marginY="30" :marginX="100"
             :onAddBtnClicked="addBtnCallback" :onEditBtnClicked="editBtnCallback" :onDeleteBtnClicked="deleteBtnCallback" />
  </div>
</template>
<script>
import BoxTree from "./components/BoxTree";
import d3 from 'd3'
export default {
  name: 'home',
  components: {
    BoxTree,
  },
  data(){
    return {
      jsonData : undefined,
      addBtnCallback: (parentID) => {
        alert("新しいNodeを追加しますか？　親：" + parentID);
        this.$refs.boxTree.addNode(parentID, "新しいNode", "新しいNodeのコメント<br>新しいNodeのコメント<br>新しいNodeのコメント");
      },
      editBtnCallback: (nodeID) => {
        alert("Nodeを編集しますか？　NodeID: " + nodeID);
        this.$refs.boxTree.editNode(nodeID, "新しいNode", "新しいNodeのコメント<br>新しいNodeのコメント<br>新しいNodeのコメント");
      },
      deleteBtnCallback: (nodeID) => {
        if (confirm("Nodeを削除しますか？　NodeID: " + nodeID)) {
            this.$refs.boxTree.deleteNode(nodeID);
        }
      }
    }
  },
  beforeMount() {
    d3.json('data-example.json',json=>{
      this.jsonData = json;
    })
  },
  methods : {}
}
</script>
