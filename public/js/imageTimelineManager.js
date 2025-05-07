export class ImageTimelineManager {
    constructor(timelineElement, getTimelineWidth, getAudioDuration, pps) {
      this.timelineElement = timelineElement;
      this.images = [];
      this.selectedWrapper = null;
      this.getTimelineWidth = getTimelineWidth;
      this.getAudioDuration = getAudioDuration;
    }
  
    getPixelsPerSecond() {
      return this.getTimelineWidth() / this.getAudioDuration();
    }
  
    addImage(src, start, duration = 5) {
      if (start === undefined) {
        start = this.getNextAvailableStart();
      }
      if (duration === undefined) {
        const remaining = this.getAudioDuration() - start;
        if (remaining <= 1) {
          alert('⛔ Không còn đủ thời gian để thêm ảnh.');
          return;
        }
        duration = Math.min(5, remaining);
      }
      
      const totalEnd = start + duration;
      if (totalEnd > this.getAudioDuration()) {
        alert('⛔ Ảnh này vượt quá thời lượng audio. Vui lòng thu ngắn lại hoặc xóa bớt ảnh trước đó.');
        return;
      }
      const wrapper = document.createElement('div');
      wrapper.className = 'absolute top-0 h-full border rounded shadow bg-white overflow-hidden';
      const pps = this.getPixelsPerSecond();
      wrapper.style.left = `${start * pps}px`;
      wrapper.style.width = `${duration * pps}px`;
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.cursor = 'move';

      wrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.selectedWrapper) {
          this.selectedWrapper.classList.remove('ring', 'ring-blue-500');
        }
        wrapper.classList.add('ring', 'ring-blue-500');
        this.selectedWrapper = wrapper;
      });
  
      const inner = document.createElement('div');
      inner.style.height = '100%';
      inner.style.margin = '0 auto';
  
      const img = document.createElement('img');
      img.src = src;
      img.className = 'h-full object-contain pointer-events-none';
      img.style.maxWidth = '100px';
  
      const rightResizer = document.createElement('div');
      const leftResizer = document.createElement('div');
      rightResizer.className = 'resizer w-2 h-full bg-blue-500 cursor-ew-resize absolute right-0 top-0';
      leftResizer.className = 'resizer w-2 h-full bg-blue-500 cursor-ew-resize absolute left-0 top-0';
  
      const imageData = { wrapper, src, start, duration };
      this.images.push(imageData);
  
      const updateTime = () => {
        const timelineWidth = this.getTimelineWidth();
        const audioDuration = this.getAudioDuration();
        const left = wrapper.offsetLeft;
        const width = wrapper.offsetWidth;
  
        imageData.start = (left / timelineWidth) * audioDuration;
        imageData.duration = (width / timelineWidth) * audioDuration;
  
        console.log(`🖼️ Image pixel width: ${width}px, Start: ${imageData.start}s, Duration: ${imageData.duration}s`);
      };
  
      const getPrevNext = () => {
        const idx = this.images.indexOf(imageData);
        return {
          prev: this.images[idx - 1],
          next: this.images[idx + 1]
        };
      };
  
      // Resize phải
      rightResizer.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        let startX = e.clientX;
        const startWidth = wrapper.offsetWidth;
        const { next } = getPrevNext();
        const pps = this.getPixelsPerSecond();
  
        const onMouseMove = (e) => {
          const delta = e.clientX - startX;
          let newWidth = startWidth + delta;
  
          const maxRight = this.getTimelineWidth();
          if (next) {
            const nextLeft = next.start * pps;
            const myLeft = wrapper.offsetLeft;
            if (myLeft + newWidth > nextLeft) {
              newWidth = nextLeft - myLeft;
            }
          } else {
            newWidth = Math.min(newWidth, maxRight - wrapper.offsetLeft);
          }
  
          if (newWidth >= 2) {
            wrapper.style.width = `${newWidth}px`;
            updateTime();
            checkAutoDelete();
          }
        };
  
        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };
  
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
  
      // Resize trái
      leftResizer.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        let startX = e.clientX;
        const startLeft = wrapper.offsetLeft;
        const startWidth = wrapper.offsetWidth;
        const { prev } = getPrevNext();
        const pps = this.getPixelsPerSecond();
  
        const onMouseMove = (e) => {
          const delta = e.clientX - startX;
          let newLeft = startLeft + delta;
          let newWidth = startWidth - delta;
  
          if (newLeft < 0) {
            newLeft = 0;
            newWidth = startWidth + startLeft;
          }
  
          if (prev) {
            const prevRight = (prev.start + prev.duration) * pps;
            if (newLeft < prevRight) {
              newLeft = prevRight;
              newWidth = startLeft + startWidth - newLeft;
            }
          }
  
          if (newWidth >= 2) {
            wrapper.style.left = `${newLeft}px`;
            wrapper.style.width = `${newWidth}px`;
            updateTime();
            checkAutoDelete();
          }
        };
  
        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };
  
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
  
      // Kéo di chuyển
      wrapper.addEventListener('mousedown', (e) => {
        if (e.target === leftResizer || e.target === rightResizer) return;
  
        let startX = e.clientX;
        const startLeft = wrapper.offsetLeft;
        const width = wrapper.offsetWidth;
        const { prev, next } = getPrevNext();
        const pps = this.getPixelsPerSecond();
  
        const onMouseMove = (e) => {
          const delta = e.clientX - startX;
          let newLeft = startLeft + delta;
  
          if (newLeft < 0) newLeft = 0;
  
          const maxLeft = this.getTimelineWidth() - width;
          if (newLeft > maxLeft) newLeft = maxLeft;
  
          if (prev) {
            const prevRight = (prev.start + prev.duration) * pps;
            if (newLeft < prevRight) newLeft = prevRight;
          }
  
          if (next) {
            const nextLeft = next.start * pps;
            if (newLeft + width > nextLeft) {
              newLeft = nextLeft - width;
            }
          }
  
          wrapper.style.left = `${newLeft}px`;
          updateTime();
        };
  
        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };
  
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
  
      inner.appendChild(img);
      wrapper.appendChild(inner);
      wrapper.appendChild(leftResizer);
      wrapper.appendChild(rightResizer);
      this.timelineElement.appendChild(wrapper);
  
      const checkAutoDelete = () => {
        const width = wrapper.offsetWidth;
        if (width < 20) {
          img.style.display = 'none';
        } else {
          img.style.display = 'block';
        }
  
        if (width <= 2) {
          this.timelineElement.removeChild(wrapper);
          this.images = this.images.filter(img => img.wrapper !== wrapper);
          if (this.selectedWrapper === wrapper) this.selectedWrapper = null;
          console.log('Image removed due to zero width.');
        }
      };
      
    }
  
    getAllImages() {
      return this.images.map(({ src, start, duration }) => ({ src, start, duration }));
    }
  
    updateImageData(wrapper) {
      const pps = this.getPixelsPerSecond();
      const left = parseFloat(wrapper.style.left);
      const width = parseFloat(wrapper.style.width);
  
      const image = this.images.find(img => img.wrapper === wrapper);
      if (image) {
        image.start = parseFloat((left / pps).toFixed(2));
        image.duration = parseFloat((width / pps).toFixed(2));
      }
    }
    getNextAvailableStart() {
      if (this.images.length === 0) return 0;
    
      const last = this.images.reduce((a, b) =>
        (a.start + a.duration > b.start + b.duration) ? a : b
      );
      return last.start + last.duration;
    }
  }
  