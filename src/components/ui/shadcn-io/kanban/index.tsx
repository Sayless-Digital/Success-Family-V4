'use client';

import type {
  Announcements,
  DndContextProps,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  PointerSensor,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  createContext,
  type HTMLAttributes,
  type ReactNode,
  useContext,
  useState,
  useRef,
  useEffect,
} from 'react';
import { createPortal } from 'react-dom';
import tunnel from 'tunnel-rat';
import { Card } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const t = tunnel();

export type { DragEndEvent } from '@dnd-kit/core';

type KanbanItemProps = {
  id: string;
  name: string;
  column: string;
} & Record<string, unknown>;

type KanbanColumnProps = {
  id: string;
  name: string;
} & Record<string, unknown>;

type KanbanContextProps<
  T extends KanbanItemProps = KanbanItemProps,
  C extends KanbanColumnProps = KanbanColumnProps,
> = {
  columns: C[];
  data: T[];
  activeCardId: string | null;
};

const KanbanContext = createContext<KanbanContextProps>({
  columns: [],
  data: [],
  activeCardId: null,
});

export type KanbanBoardProps = {
  id: string;
  children: ReactNode;
  className?: string;
};

export const KanbanBoard = ({ id, children, className }: KanbanBoardProps) => {
  // Don't make the board droppable - let the cards container handle it
  // This avoids conflicts with nested droppables
  return (
    <div
      className={cn(
        'flex size-full min-h-40 flex-col divide-y overflow-visible rounded-md border bg-secondary text-xs shadow-sm',
        className
      )}
      style={{ position: 'relative' }}
    >
      {children}
    </div>
  );
};

export type KanbanCardProps<T extends KanbanItemProps = KanbanItemProps> = T & {
  children?: ReactNode;
  className?: string;
};

export const KanbanCard = <T extends KanbanItemProps = KanbanItemProps>({
  id,
  name,
  children,
  className,
}: KanbanCardProps<T>) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transition,
    transform,
    isDragging,
  } = useSortable({
    id,
  });
  const { activeCardId } = useContext(KanbanContext) as KanbanContextProps;

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  return (
    <>
      <div style={style} {...listeners} {...attributes} ref={setNodeRef}>
        <Card
          className={cn(
            'cursor-grab gap-4 rounded-md p-3 shadow-sm',
            isDragging && 'pointer-events-none cursor-grabbing opacity-30',
            className
          )}
        >
          {children ?? <p className="m-0 font-medium text-sm">{name}</p>}
        </Card>
      </div>
      {activeCardId === id && (
        <t.In>
          <Card
            className={cn(
              'cursor-grab gap-4 rounded-md p-3 shadow-lg ring-2 ring-white/40 bg-white/10 border-white/20',
              isDragging && 'cursor-grabbing',
              className
            )}
          >
            {children ?? <p className="m-0 font-medium text-sm">{name}</p>}
          </Card>
        </t.In>
      )}
    </>
  );
};

export type KanbanCardsProps<T extends KanbanItemProps = KanbanItemProps> =
  Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'id'> & {
    children: (item: T) => ReactNode;
    id: string;
  };

export const KanbanCards = <T extends KanbanItemProps = KanbanItemProps>({
  children,
  className,
  ...props
}: KanbanCardsProps<T>) => {
  const { data } = useContext(KanbanContext) as KanbanContextProps<T>;
  const filteredData = data.filter((item) => item.column === props.id);
  const items = filteredData.map((item) => item.id);
  
  // Make the entire cards container droppable - this covers the full height
  const { isOver, setNodeRef } = useDroppable({
    id: `${props.id}-cards`,
  });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        'flex-1 flex flex-col min-h-0 relative',
        isOver && 'bg-white/5'
      )}
    >
      <ScrollArea className="overflow-hidden flex-1 h-full">
        <div className="w-full h-full">
          <SortableContext items={items}>
            <div
              className={cn('flex flex-col gap-2 w-full p-2', className)}
              style={{ 
                minHeight: '100%',
                paddingTop: '0.5rem',
                paddingBottom: '0.5rem',
              }}
            >
              {filteredData.length > 0 ? (
                <>
                  {filteredData.map(children)}
                  {/* Add a drop zone indicator at the bottom when dragging */}
                  {isOver && (
                    <div className="h-16 border-2 border-dashed border-white/40 rounded-md flex items-center justify-center text-white/60 text-xs mt-2 bg-white/5">
                      ↓ Drop here
                    </div>
                  )}
                </>
              ) : (
                <div className={cn(
                  "flex items-center justify-center w-full flex-1 text-white/40 text-sm border-2 border-dashed rounded-md transition-all",
                  isOver && "border-white/50 bg-white/5 scale-[1.02]"
                )} style={{ minHeight: '100%' }}>
                  <div className="text-center p-8">
                    <div className="text-3xl mb-4">{isOver ? "↓" : ""}</div>
                    <div className="text-base font-medium">{isOver ? "Drop here" : "Drop cards here"}</div>
                    {isOver && (
                      <div className="text-xs text-white/50 mt-2">Release to drop</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </SortableContext>
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
      {/* Visual drop indicator overlay covering entire area */}
      {isOver && (
        <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-white/40 rounded-md z-10" />
      )}
    </div>
  );
};

export type KanbanHeaderProps = HTMLAttributes<HTMLDivElement>;

export const KanbanHeader = ({ className, ...props }: KanbanHeaderProps) => (
  <div className={cn('m-0 p-2 font-semibold text-sm', className)} {...props} />
);

export type KanbanProviderProps<
  T extends KanbanItemProps = KanbanItemProps,
  C extends KanbanColumnProps = KanbanColumnProps,
> = Omit<DndContextProps, 'children'> & {
  children: (column: C) => ReactNode;
  className?: string;
  columns: C[];
  data: T[];
  onDataChange?: (data: T[]) => void;
  onDragStart?: (event: DragStartEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
};

export const KanbanProvider = <
  T extends KanbanItemProps = KanbanItemProps,
  C extends KanbanColumnProps = KanbanColumnProps,
>({
  children,
  onDragStart,
  onDragEnd,
  onDragOver,
  className,
  columns,
  data,
  onDataChange,
  ...props
}: KanbanProviderProps<T, C>) => {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  // Use ref to always have access to latest data
  const dataRef = useRef(data);
  
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Configure sensors with activation constraints to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before drag starts
      },
    }),
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms delay for touch
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const card = data.find((item) => item.id === event.active.id);
    if (card) {
      setActiveCardId(event.active.id as string);
    }
    onDragStart?.(event);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;

    if (!over) {
      return;
    }

    // Use ref to get latest data
    const currentData = dataRef.current;
    const activeItem = currentData.find((item) => item.id === active.id);
    if (!activeItem) {
      return;
    }

    // Determine target column
    // Priority: cards container > other card
    // Note: Board is no longer droppable to avoid conflicts
    let targetColumn: string | undefined;
    
    // Check if over is a cards container (primary droppable)
    const cardsContainerMatch = over.id.toString().match(/^(.+)-cards$/);
    if (cardsContainerMatch) {
      targetColumn = cardsContainerMatch[1];
    } else {
      // Check if over is another card
      const overItem = currentData.find((item) => item.id === over.id);
      if (overItem) {
        targetColumn = overItem.column;
      }
    }

    // Only update if moving to a different column
    if (targetColumn && activeItem.column !== targetColumn) {
      let newData = [...currentData];
      const activeIndex = newData.findIndex((item) => item.id === active.id);
      
      // Update the column
      newData[activeIndex] = { ...newData[activeIndex], column: targetColumn };
      
      // If dropped on another card, position it near that card
      const overItem = currentData.find((item) => item.id === over.id);
      if (overItem && overItem.column === targetColumn) {
        const overIndex = newData.findIndex((item) => item.id === over.id);
        // Move to the position of the card we're over
        newData = arrayMove(newData, activeIndex, overIndex);
      } else {
        // If dropped on column or empty area, move to end of that column
        const targetColumnItems = newData
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => item.column === targetColumn && item.id !== active.id);
        
        if (targetColumnItems.length > 0) {
          // Move to end of target column
          const lastTargetIndex = targetColumnItems[targetColumnItems.length - 1].index;
          newData = arrayMove(newData, activeIndex, lastTargetIndex + 1);
        }
      }

      // Update ref immediately
      dataRef.current = newData;
      onDataChange?.(newData);
    }

    onDragOver?.(event);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCardId(null);

    // Call user's handler first - they have access to the updated data from handleDataChange
    // The parent's handleDragEnd will handle the database update
    onDragEnd?.(event);

    // Also ensure visual state is correct by updating data one more time
    // This handles edge cases where dragOver might have missed an update
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    // Use ref to get latest data
    const currentData = dataRef.current;
    const activeItem = currentData.find((item) => item.id === active.id);
    if (!activeItem) {
      return;
    }

    // Determine target column using same logic as dragOver
    // Priority: cards container > other card
    // Note: Board is no longer droppable to avoid conflicts
    let targetColumn: string | undefined;
    
    // Check if over is a cards container (primary droppable)
    const cardsContainerMatch = over.id.toString().match(/^(.+)-cards$/);
    if (cardsContainerMatch) {
      targetColumn = cardsContainerMatch[1];
    } else {
      // Check if over is another card
      const overItem = currentData.find((item) => item.id === over.id);
      if (overItem) {
        targetColumn = overItem.column;
      }
    }

    // Only update if column changed and we have a target
    if (targetColumn && activeItem.column !== targetColumn) {
      let newData = [...currentData];
      const activeIndex = newData.findIndex((item) => item.id === active.id);
      
      // Update the column
      newData[activeIndex] = { ...newData[activeIndex], column: targetColumn };
      
      // Position the item correctly
      const overItem = currentData.find((item) => item.id === over.id);
      if (overItem && overItem.column === targetColumn) {
        // Dropped on another card - position near that card
        const overIndex = newData.findIndex((item) => item.id === over.id);
        newData = arrayMove(newData, activeIndex, overIndex);
      } else {
        // Dropped on column or empty area - move to end of target column
        const targetColumnItems = newData
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => item.column === targetColumn && item.id !== active.id);
        
        if (targetColumnItems.length > 0) {
          const lastTargetIndex = targetColumnItems[targetColumnItems.length - 1].index;
          newData = arrayMove(newData, activeIndex, lastTargetIndex + 1);
        }
      }

      // Update ref immediately
      dataRef.current = newData;
      onDataChange?.(newData);
    }
  };

  const announcements: Announcements = {
    onDragStart({ active }) {
      const { name, column } = data.find((item) => item.id === active.id) ?? {};

      return `Picked up the card "${name}" from the "${column}" column`;
    },
    onDragOver({ active, over }) {
      const { name } = data.find((item) => item.id === active.id) ?? {};
      const newColumn = columns.find((column) => column.id === over?.id)?.name;

      return `Dragged the card "${name}" over the "${newColumn}" column`;
    },
    onDragEnd({ active, over }) {
      const { name } = data.find((item) => item.id === active.id) ?? {};
      const newColumn = columns.find((column) => column.id === over?.id)?.name;

      return `Dropped the card "${name}" into the "${newColumn}" column`;
    },
    onDragCancel({ active }) {
      const { name } = data.find((item) => item.id === active.id) ?? {};

      return `Cancelled dragging the card "${name}"`;
    },
  };

  return (
    <KanbanContext.Provider value={{ columns, data, activeCardId }}>
      <DndContext
        accessibility={{ announcements }}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        sensors={sensors}
        {...props}
      >
        <div
          className={cn(
            'grid size-full auto-cols-fr grid-flow-col gap-4',
            className
          )}
          style={{ overflowY: 'visible' }}
        >
          {columns.map((column) => children(column))}
        </div>
        {typeof window !== 'undefined' &&
          createPortal(
            <DragOverlay>
              <t.Out />
            </DragOverlay>,
            document.body
          )}
      </DndContext>
    </KanbanContext.Provider>
  );
};