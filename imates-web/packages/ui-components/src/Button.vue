<template>
    <button class="shared-button" @click="$emit('click')">
      <slot></slot>
    </button>
  </template>
  
  <script setup>
  defineEmits(['click']);
  </script>
  
  <style scoped>
  .shared-button {
    background-color: #42b983;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 5px;
    cursor: pointer;
  }
  .shared-button:hover {
    background-color: #349a6d;
  }
  </style>