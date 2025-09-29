package events

import (
	"log"
	"sync"
)

type Handler func(event Event) error

type Dispatcher struct {
	handlers map[EventType][]Handler
	mu       sync.RWMutex
	async    bool
}

func NewDispatcher() *Dispatcher {
	return &Dispatcher{
		handlers: make(map[EventType][]Handler),
		async:    false, // Default to synchronous for backward compatibility
	}
}

func NewAsyncDispatcher() *Dispatcher {
	return &Dispatcher{
		handlers: make(map[EventType][]Handler),
		async:    true,
	}
}

func (d *Dispatcher) Subscribe(eventType EventType, handler Handler) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.handlers[eventType] = append(d.handlers[eventType], handler)
}

func (d *Dispatcher) Dispatch(event Event) {
	d.mu.RLock()
	handlers := d.handlers[event.Type]
	d.mu.RUnlock()

	if d.async {
		// Asynchronous execution - don't block the caller
		for _, handler := range handlers {
			go d.executeHandler(handler, event)
		}
	} else {
		// Synchronous execution - maintain existing behavior
		for _, handler := range handlers {
			d.executeHandler(handler, event)
		}
	}
}

func (d *Dispatcher) executeHandler(handler Handler, event Event) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Warning: event handler panicked for %s: %v", event.Type, r)
		}
	}()

	if err := handler(event); err != nil {
		log.Printf("Warning: event handler failed for %s: %v", event.Type, err)
	}
}