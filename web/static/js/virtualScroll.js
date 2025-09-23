// Virtual scrolling implementation for large post lists
class VirtualScroller {
    constructor(container, itemHeight = 200) {
        this.container = container;
        this.itemHeight = itemHeight;
        this.visibleItems = Math.ceil(window.innerHeight / itemHeight) + 5; // Buffer items
        this.scrollTop = 0;
        this.items = [];
        this.renderedItems = new Map();

        this.viewport = document.createElement('div');
        this.viewport.style.cssText = 'position: relative; overflow: auto; height: 100%;';

        this.content = document.createElement('div');
        this.content.style.cssText = 'position: relative;';

        this.viewport.appendChild(this.content);

        // Replace container content
        this.container.innerHTML = '';
        this.container.appendChild(this.viewport);

        this.viewport.addEventListener('scroll', this.handleScroll.bind(this));
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    setItems(items) {
        this.items = items;
        this.updateContentHeight();
        this.render();
    }

    addItems(newItems) {
        this.items = [...this.items, ...newItems];
        this.updateContentHeight();
        this.render();
    }

    removeItem(itemId) {
        this.items = this.items.filter(item => item.id !== itemId);
        this.updateContentHeight();
        this.render();
    }

    updateContentHeight() {
        const totalHeight = this.items.length * this.itemHeight;
        this.content.style.height = `${totalHeight}px`;
    }

    handleScroll() {
        this.scrollTop = this.viewport.scrollTop;
        this.render();
    }

    handleResize() {
        this.visibleItems = Math.ceil(window.innerHeight / this.itemHeight) + 5;
        this.render();
    }

    render() {
        const startIndex = Math.floor(this.scrollTop / this.itemHeight);
        const endIndex = Math.min(startIndex + this.visibleItems, this.items.length);

        // Remove items that are no longer visible
        for (const [index, element] of this.renderedItems.entries()) {
            if (index < startIndex || index >= endIndex) {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
                this.renderedItems.delete(index);
            }
        }

        // Add new visible items
        for (let i = startIndex; i < endIndex; i++) {
            if (!this.renderedItems.has(i) && this.items[i]) {
                const element = this.createItemElement(this.items[i]);
                element.style.cssText = `position: absolute; top: ${i * this.itemHeight}px; left: 0; right: 0;`;
                this.content.appendChild(element);
                this.renderedItems.set(i, element);
            }
        }
    }

    createItemElement(item) {
        // This should be overridden by the implementation
        const div = document.createElement('div');
        div.textContent = `Item ${item.id}`;
        div.style.height = `${this.itemHeight}px`;
        return div;
    }

    scrollToTop() {
        this.viewport.scrollTop = 0;
    }

    destroy() {
        window.removeEventListener('resize', this.handleResize.bind(this));
        this.viewport.removeEventListener('scroll', this.handleScroll.bind(this));
    }
}

// Post-specific virtual scroller
class PostVirtualScroller extends VirtualScroller {
    constructor(container) {
        // Estimate post height - this could be dynamic based on content
        super(container, 250);
        this.postHeights = new Map();
    }

    createItemElement(post) {
        const element = createPostElement(post);

        // Measure actual height after creation
        document.body.appendChild(element);
        const height = element.offsetHeight;
        document.body.removeChild(element);

        this.postHeights.set(post.id, height);

        return element;
    }

    // Override to use dynamic heights if needed
    getItemHeight(index) {
        const post = this.items[index];
        return this.postHeights.get(post.id) || this.itemHeight;
    }
}