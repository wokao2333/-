<template>
  <p
    ref="textRef"
    class="text-content break-words w-1/1 h-1/1"
    :class="[props.vertical ? 'text-vertical' : '', { 'text-editing': isEditing }]"
    :contenteditable="props.editable && isEditing"
    :style="{ fontFamily: props.fontFamily, fontSize: props.fontSize + 'px', color: props.fill }"
    :aria-label="props.editable ? '编辑文字' : undefined"
    v-text="isEditing ? editingText : props.text"
    @dblclick.stop.prevent="startEditing"
    @mousedown="onMouseDown"
    @keydown="onKeydown"
    @blur="finishEditing"
  ></p>
</template>
<script setup lang="ts">
import { nextTick, ref } from 'vue';

const emits = defineEmits<{
  (event: 'update:text', value: string): void;
}>();

const props = defineProps({
  fontFamily: {
    type: String,
    default: ''
  },
  fontSize: {
    type: Number,
    default: 15
  },
  text: {
    type: String,
    default: ''
  },
  fill: {
    type: String,
    default: ''
  },
  vertical: {
    type: Boolean,
    default: false
  },
  editable: {
    type: Boolean,
    default: true
  }
});

const textRef = ref<HTMLElement>();
const isEditing = ref(false);
const editingText = ref('');

const placeCaretAtEnd = (element: HTMLElement) => {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
};

const startEditing = () => {
  if (!props.editable || isEditing.value) return;
  editingText.value = props.text;
  isEditing.value = true;
  nextTick(() => {
    const element = textRef.value;
    if (!element) return;
    element.focus();
    placeCaretAtEnd(element);
  });
};

const onMouseDown = (event: MouseEvent) => {
  if (isEditing.value) {
    event.stopPropagation();
  }
};

const finishEditing = () => {
  if (!isEditing.value) return;
  const value = (textRef.value?.innerText ?? '').replace(/\r\n/g, '\n');
  isEditing.value = false;
  if (value !== props.text) {
    emits('update:text', value);
  }
};

const cancelEditing = () => {
  if (!isEditing.value) return;
  isEditing.value = false;
};

const onKeydown = (event: KeyboardEvent) => {
  if (!isEditing.value) return;
  event.stopPropagation();
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelEditing();
  } else if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    finishEditing();
  }
};
</script>
<style scoped>
.text-content {
  margin: 0;
  white-space: pre-wrap;
}

.text-editing {
  cursor: text;
  outline: 1px solid #409eff;
  user-select: text;
}

.text-vertical {
  writing-mode: tb;
  letter-spacing: 5px;
}
</style>
