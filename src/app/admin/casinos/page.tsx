"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

// Dynamic import for react-beautiful-dnd to reduce initial bundle size
const DragDropContext = dynamic(() => import("react-beautiful-dnd").then(mod => ({ default: mod.DragDropContext })), { ssr: false });
const Droppable = dynamic(() => import("react-beautiful-dnd").then(mod => ({ default: mod.Droppable })), { ssr: false });
const Draggable = dynamic(() => import("react-beautiful-dnd").then(mod => ({ default: mod.Draggable })), { ssr: false });
import { toast } from "react-hot-toast";
import Image from "next/image";
import { normalizeImagePath } from "@/lib/image-utils";

interface Casino {
  id: string;
  name?: string;
  slug?: string;
  logo?: string | null;
  description?: string;
  rating?: number;
  displayOrder?: number;
  bonuses?: any[];
}

interface Bonus {
  id: string;
  title: string;
  description: string;
  code: string | null;
  type: string;
  value: string;
}

export default function CasinosPage() {
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const [filteredCasinos, setFilteredCasinos] = useState<Casino[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCasinos, setSelectedCasinos] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchCasinos();
  }, []);

  useEffect(() => {
    if (searchTerm === "") {
      setFilteredCasinos(casinos);
    } else {
      const filtered = casinos.filter(
        casino => 
          (casino.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
          (casino.slug || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (casino.description || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCasinos(filtered);
    }
  }, [searchTerm, casinos]);

  useEffect(() => {
    if (selectAll) {
      setSelectedCasinos(filteredCasinos.map(casino => casino.id));
    } else {
      setSelectedCasinos([]);
    }
  }, [selectAll, filteredCasinos]);

  const fetchCasinos = async () => {
    try {
      setError(null);
      const response = await fetch("/api/casinos");
      if (!response.ok) {
        throw new Error("Failed to fetch casinos");
      }
      const data = await response.json();
      
      // Make sure casinos are sorted by displayOrder
      const sortedCasinos = [...data].sort((a, b) => 
        (a.displayOrder || 0) - (b.displayOrder || 0)
      );
      
      setCasinos(sortedCasinos);
      setFilteredCasinos(sortedCasinos);
    } catch (error) {
      console.error("Failed to fetch casinos:", error);
      setError("Failed to load casinos. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/casinos?search=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) {
        throw new Error("Failed to search casinos");
      }
      const data = await response.json();
      
      // Sort by displayOrder
      const sortedCasinos = [...data].sort((a, b) => 
        (a.displayOrder || 0) - (b.displayOrder || 0)
      );
      
      setFilteredCasinos(sortedCasinos);
    } catch (error) {
      console.error("Failed to search casinos:", error);
      setError("Failed to search casinos. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this casino?")) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/casinos/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete casino");
      }

      // Update both lists
      const updatedCasinos = casinos.filter((casino) => casino.id !== id);
      setCasinos(updatedCasinos);
      setFilteredCasinos(filteredCasinos.filter((casino) => casino.id !== id));
      setSelectedCasinos(selectedCasinos.filter(casinoId => casinoId !== id));
      router.refresh();
    } catch (error) {
      console.error("Failed to delete casino:", error);
      setError("Failed to delete casino. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCasinos.length === 0) {
      setError("No casinos selected for deletion");
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedCasinos.length} casinos?`)) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/casinos/bulk-delete`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: selectedCasinos }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete casinos");
      }

      // Update both lists
      const remainingCasinos = casinos.filter((casino) => !selectedCasinos.includes(casino.id));
      setCasinos(remainingCasinos);
      setFilteredCasinos(remainingCasinos);
      setSelectedCasinos([]);
      setSelectAll(false);
      router.refresh();
    } catch (error) {
      console.error("Failed to delete casinos:", error);
      setError("Failed to delete casinos. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectCasino = (id: string) => {
    if (selectedCasinos.includes(id)) {
      setSelectedCasinos(selectedCasinos.filter(casinoId => casinoId !== id));
      setSelectAll(false);
    } else {
      setSelectedCasinos([...selectedCasinos, id]);
      if (selectedCasinos.length + 1 === filteredCasinos.length) {
        setSelectAll(true);
      }
    }
  };

  const toggleSelectAll = () => {
    setSelectAll(!selectAll);
  };

  const onDragEnd = async (result: any) => {
    setIsDragging(false);
    
    // Dropped outside the list
    if (!result.destination) {
      return;
    }

    // If position didn't change
    if (result.destination.index === result.source.index) {
      return;
    }

    // Create a copy of the current list
    const items = Array.from(filteredCasinos);
    // Remove the dragged item
    const [removed] = items.splice(result.source.index, 1);
    // Insert at the new position
    items.splice(result.destination.index, 0, removed);

    // Update filtered casinos state
    setFilteredCasinos(items);
    
    // Update main casinos list state to match
    // We need to maintain the same order in both lists
    setCasinos(prev => {
      const newOrder = [...prev];
      
      // Find indices in the full list
      const fromIndex = newOrder.findIndex(c => c.id === removed.id);
      const allBeforeDestination = items.slice(0, result.destination.index).map(c => c.id);
      
      if (fromIndex >= 0) {
        // Remove from old position
        newOrder.splice(fromIndex, 1);
        
        // Find new position in the full list
        let toIndex = 0;
        for (let i = newOrder.length - 1; i >= 0; i--) {
          if (allBeforeDestination.includes(newOrder[i].id)) {
            toIndex = i + 1;
            break;
          }
        }
        
        // Insert at new position
        newOrder.splice(toIndex, 0, removed);
      }
      
      return newOrder;
    });
    
    // Set flag to indicate order has changed
    setHasChanges(true);
  };

  const saveNewOrder = async () => {
    try {
      setIsSaving(true);
      
      // Get the current IDs in order
      const orderedIds = filteredCasinos.map(casino => casino.id);
      
      const response = await fetch('/api/casinos/update-order', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for auth
        body: JSON.stringify({ orderedIds }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update order');
      }
      
      toast.success('Casino order updated successfully');
      setIsSaving(false);
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving new order:', error);
      toast.error(`Error: ${error instanceof Error ? error.message : 'Failed to update order'}`);
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="admin-spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Casinos</h2>
          <p className="text-[#a7a9b4] mt-1">
            Total: {filteredCasinos.length}
            {isDragging && <span className="ml-2 text-yellow-400">(Dragging...)</span>}
          </p>
          {hasChanges && (
            <p className="text-yellow-400 text-sm mt-1">
              Order has been changed. Don't forget to save your changes.
            </p>
          )}
        </div>
        <div className="flex gap-3">
          {hasChanges && (
            <button
              onClick={saveNewOrder}
              className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
            >
              Save New Order
            </button>
          )}
          <Link
            href="/admin/casinos/new"
            className="px-4 py-2 bg-[#68D08B] text-white rounded-md hover:bg-[#5abc7a] transition-colors"
          >
            Add New Casino
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-500 text-white p-3 rounded-md">
          {error}
        </div>
      )}

      {/* Search bar */}
      <div className="flex items-center space-x-4">
        <div className="flex-grow">
          <input
            type="text"
            placeholder="Search casinos by name, slug, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-[#1d1d25] border border-[#404055] rounded-md text-white focus:outline-none focus:ring-2 focus:ring-[#68D08B]"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-[#373946] text-white rounded-md hover:bg-[#454655] transition-colors"
        >
          Search
        </button>
        {selectedCasinos.length > 0 && (
          <button
            onClick={handleBulkDelete}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
          >
            Delete Selected ({selectedCasinos.length})
          </button>
        )}
      </div>

      <div className="bg-[#292932] shadow-md rounded-lg overflow-hidden border border-[#404055]">
        <DragDropContext 
          onDragStart={() => setIsDragging(true)}
          onDragEnd={onDragEnd}
        >
          <Droppable droppableId="casinos">
            {(provided) => (
              <table 
                className="min-w-full divide-y divide-[#404055]"
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                <thead className="bg-[#373946]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#a7a9b4] uppercase tracking-wider w-8">
                      Order
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#a7a9b4] uppercase tracking-wider w-16">
                      Logo
                    </th>
                    <th className="px-2 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-[#404055] text-[#68D08B] focus:ring-[#68D08B]"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#a7a9b4] uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#a7a9b4] uppercase tracking-wider">
                      Rating <span className="text-xs font-normal opacity-75">(from reviews)</span>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[#a7a9b4] uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-[#292932] divide-y divide-[#404055]">
                  {filteredCasinos.map((casino, index) => (
                    <Draggable key={casino.id} draggableId={casino.id} index={index}>
                      {(provided, snapshot) => (
                        <tr
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={snapshot.isDragging ? "bg-[#373946] opacity-80" : "hover:bg-[#323240]"}
                        >
                          <td 
                            className="px-6 py-4 whitespace-nowrap cursor-move w-10"
                            {...provided.dragHandleProps}
                          >
                            <div className="flex items-center justify-center w-6 h-6 bg-[#373946] rounded-md text-white">
                              {index + 1}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="w-10 h-10 rounded overflow-hidden bg-[#2c2f3a] flex items-center justify-center">
                              {casino.logo ? (
                                <Image
                                  src={normalizeImagePath(casino.logo)}
                                  alt={`${casino.name || 'Casino'} Logo`}
                                  width={40}
                                  height={40}
                                  className="object-contain"
                                  onError={(e) => {
                                    // Fallback to initials when image fails to load
                                    e.currentTarget.style.display = 'none';
                                    const name = casino.name || 'Casino';
                                    const parentElement = e.currentTarget.parentElement;
                                    if (parentElement) {
                                      parentElement.innerHTML = name.substring(0, 2).toUpperCase();
                                    }
                                  }}
                                />
                              ) : (
                                <span className="text-white text-sm font-medium">
                                  {(casino.name || 'Casino').substring(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-center">
                            <input
                              type="checkbox"
                              checked={selectedCasinos.includes(casino.id)}
                              onChange={() => toggleSelectCasino(casino.id)}
                              className="h-4 w-4 rounded border-[#404055] text-[#68D08B] focus:ring-[#68D08B]"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-white">
                              {casino.name || 'Unnamed Casino'}
                            </div>
                            <div className="text-sm text-[#a7a9b4]">{casino.slug || 'no-slug'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-white">
                              {casino.rating ? `${casino.rating.toFixed(1)}/5` : '0.0/5'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => router.push(`/admin/casinos/${casino.id}`)}
                              className="text-[#68D08B] hover:text-[#5abc7a] mr-3"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => router.push(`/admin/casinos/${casino.id}/content`)}
                              className="text-blue-400 hover:text-blue-300 mr-3"
                            >
                              Content
                            </button>
                            <button
                              onClick={() => handleDelete(casino.id)}
                              className="text-red-400 hover:text-red-300"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  {filteredCasinos.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-[#a7a9b4]">
                        {searchTerm ? "No casinos found matching your search." : "No casinos found. Create your first casino by clicking the \"Add New Casino\" button."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </div>
  );
} 