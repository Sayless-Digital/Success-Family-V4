# URGENT: Quick Fix for Broken Kanban

The Kanban is currently broken due to `fetchData` not being in scope. Here's the **MINIMAL FIX** to get it working:

## Option 1: Quick Fix (5 minutes)

Open `src/app/admin/crm/page.tsx` and make these 5 changes:

### Change 1: Line ~556-563 (Add onRefresh prop)
**Find this line:**
```typescript
            <KanbanView
              leadsByStage={leadsByStage}
              stages={stages}
              onEdit={handleEditLead}
              onDelete={handleDeleteLead}
              onView={handleViewLead}
              onMove={handleMoveLead}
            />
```

**Add onRefresh:**
```typescript
            <KanbanView
              leadsByStage={leadsByStage}
              stages={stages}
              onEdit={handleEditLead}
              onDelete={handleDeleteLead}
              onView={handleViewLead}
              onMove={handleMoveLead}
              onRefresh={fetchData}
            />
```

### Change 2: Line ~1131-1138 (Add onRefresh to function signature)
**Find:**
```typescript
function KanbanView({
  leadsByStage,
  stages,
  onEdit,
  onDelete,
  onView,
  onMove
}: {
```

**Add onRefresh:**
```typescript
function KanbanView({
  leadsByStage,
  stages,
  onEdit,
  onDelete,
  onView,
  onMove,
  onRefresh
}: {
```

**And in the type definition below, add:**
```typescript
  onRefresh: () => void
```

### Change 3: Line ~1264 (Use onRefresh instead of fetchData)
**Find:**
```typescript
            fetchData()
```

**Change to:**
```typescript
            onRefresh()
```

### Change 4: Line ~1269 (Update dependency array)
**Find:**
```typescript
  }, [localData, fetchData])
```

**Change to:**
```typescript
  }, [localData, onRefresh])
```

### Change 5: Line ~1307 (Remove onDragStart)
**Find:**
```typescript
          onDragStart={handleDragStart}
```

**Delete this entire line** (the KanbanProvider doesn't need it)

---

## After These Changes

The Kanban should work again. Save the file and reload the page.

If you still see errors, check the browser console and share the error message.