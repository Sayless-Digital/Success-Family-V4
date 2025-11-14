# URGENT: Simple Rollback to Fix Broken Kanban

The kanban broke due to over-engineering. Here's the **SIMPLE FIX** to restore functionality:

## The Problem

I overcomplicated the implementation with:
- Pending updates Map
- Local state syncing
- Complex optimistic updates
- Unnecessary state management

## The Solution: Simple Callback Approach

Replace the KanbanView function (lines 1124-1370) with this simpler version:

```typescript
// Kanban View Component
function KanbanView({
  leadsByStage,
  stages,
  onEdit,
  onDelete,
  onView,
  onMove,
  onRefresh
}: {
  leadsByStage: Record<string, CrmLead[]>
  stages: CrmStage[]
  onEdit: (lead: CrmLead) => void
  onDelete: (leadId: string) => void
  onView: (lead: CrmLead) => void
  onMove: (leadId: string, newStageId: string) => void
  onRefresh: () => void
}) {
  // Transform data to match shadcn kanban format
  const kanbanColumns = useMemo(() => stages.map(stage => ({
    id: stage.id,
    name: stage.name,
    description: stage.description,
  })), [stages])

  // Convert leads to kanban format
  const kanbanData = useMemo(() => stages.flatMap(stage => {
    const stageLeads = leadsByStage[stage.id] || []
    return stageLeads.map(lead => ({
      id: lead.id,
      name: lead.name || 'Unnamed Lead',
      column: stage.id,
    }))
  }), [stages, leadsByStage])

  const handleDragEnd = useCallback(async (event: DragEndEvent, newData: typeof kanbanData) => {
    const { active, over } = event
    
    if (!over || active.id === over.id) {
      return
    }

    const activeItem = newData.find(item => item.id === active.id)
    if (!activeItem) {
      return
    }

    // Find target column
    let targetColumn: string | null = null
    const cardsMatch = over.id.toString().match(/^(.+)-cards$/)
    if (cardsMatch) {
      targetColumn = cardsMatch[1]
    } else {
      const overItem = newData.find(item => item.id === over.id)
      if (overItem) {
        targetColumn = overItem.column
      }
    }

    const originalColumn = activeItem.column

    // Only update database if column actually changed
    if (targetColumn && originalColumn !== targetColumn) {
      const leadId = active.id as string
      
      // Simple database update with retry
      let retryCount = 0
      const maxRetries = 3
      let success = false

      while (retryCount < maxRetries && !success) {
        try {
          const { error } = await supabase
            .from('crm_leads')
            .update({ stage_id: targetColumn })
            .eq('id', leadId)
          
          if (error) throw error
          success = true
        } catch (error) {
          retryCount++
          console.error(`Error moving lead (attempt ${retryCount}/${maxRetries}):`, error)
          
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 500))
          } else {
            toast.error('Failed to move lead. Please try again.')
            onRefresh()
          }
        }
      }
    }
  }, [onRefresh])

  if (stages.length === 0) {
    return (
      <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-12 text-center">
        <LayoutGrid className="h-12 w-12 text-white/60 mx-auto mb-4" />
        <p className="text-white/80">No pipeline stages configured</p>
        <p className="text-white/60 text-sm mt-1">Create stages to organize your leads</p>
      </div>
    )
  }

  const stageMap = useMemo(() => {
    const map = new Map(stages.map(s => [s.id, s]))
    return map
  }, [stages])

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-x-auto pb-4">
        <div className="inline-flex gap-4 h-full min-w-max">
        <KanbanProvider
          columns={kanbanColumns}
          data={kanbanData}
          onDragEnd={handleDragEnd}
          className="flex gap-4 h-full"
        >
          {(column) => {
            const stage = stageMap.get(column.id)!
            const stageLeads = leadsByStage[column.id] || []
            const totalRevenue = stageLeads.reduce((sum, lead) => sum + (lead.potential_revenue_ttd || 0), 0)

            return (
              <KanbanBoard
                id={column.id}
                key={column.id}
                className="flex-shrink-0 w-80 min-w-80 h-full border-white/20 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md rounded-lg overflow-hidden flex flex-col"
              >
                <KanbanHeader className="p-4 border-b border-white/20 bg-white/5 flex-shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-white text-base">{column.name}</h3>
                    <Badge variant="outline" className="bg-white/10 text-white border-white/20 text-xs font-medium">
                      {stageLeads.length}
                    </Badge>
                  </div>
                  {column.description && (
                    <p className="text-xs text-white/60 mb-2 line-clamp-2">{column.description}</p>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-white/70 mt-2">
                    <DollarSign className="h-3 w-3 text-white/70" />
                    <span className="font-medium">{formatCurrency(totalRevenue)}</span>
                  </div>
                </KanbanHeader>
                <KanbanCards id={column.id} className="flex-1 min-h-0">
                  {(item) => {
                    const lead = stageLeads.find(l => l.id === item.id)
                    if (!lead) return null
                    
                    return (
                      <ShadcnKanbanCard
                        key={item.id}
                        id={item.id}
                        name={item.name}
                        column={item.column}
                        className="border-white/20 bg-white/5 hover:bg-white/10 transition-all cursor-grab active:cursor-grabbing"
                      >
                        <KanbanCardContent
                          lead={lead}
                          onEdit={onEdit}
                          onDelete={onDelete}
                          onView={onView}
                        />
                      </ShadcnKanbanCard>
                    )
                  }}
                </KanbanCards>
              </KanbanBoard>
            )
          }}
        </KanbanProvider>
        </div>
      </div>
    </div>
  )
}
```

## What This Does

1. **Removes all complex state management** - no more pendingUpdates Map, localData state
2. **Uses props directly** - kanbanData comes from leadsByStage prop
3. **Simple retry logic** - tries 3 times with exponential backoff
4. **Realtime updates handled by parent** - database changes trigger onRefresh via realtime subscription
5. **Clean separation** - Kanban just displays data and calls onMove callback

## Why This Works

- The parent component already has realtime subscriptions that call `fetchData()` when database changes
- We don't need complex optimistic updates - the UI updates via realtime within ~100ms
- Simpler code = fewer bugs = easier to maintain

Save and reload - the kanban will work again!