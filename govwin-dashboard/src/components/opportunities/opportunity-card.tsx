// src/components/opportunities/opportunity-card.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  DollarSign, 
  ExternalLink, 
  Building, 
  Archive,
  Users,
  Eye, 
  Bookmark,
  BookmarkCheck,
  Copy,
  Check,
  Clock,
  Tag,
  FileText,
  Target,
} from 'lucide-react';
import { OpportunityDocument } from '@/lib/types';
import { useMarkSeen, useToggleSaved, useArchiveOpportunity, usePursueOpportunity } from '@/hooks/use-user-actions';
import { format, parseISO } from 'date-fns';

interface OpportunityCardProps {
  opportunity: OpportunityDocument;
  userId: string;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  showSeenTracking?: boolean;      
  showPursueButton?: boolean;      
  pageType?: 'dashboard' | 'saved'; 
}

export function OpportunityCard({ 
  opportunity, 
  userId, 
  isExpanded = false,
  onToggleExpanded,
  showSeenTracking = true,        // Default to current behavior
  showPursueButton = false,       // Default off
  pageType = 'dashboard'
}: OpportunityCardProps) {
  const [copiedSolicitation, setCopiedSolicitation] = useState(false);
  const markSeenMutation = useMarkSeen();
  const toggleSavedMutation = useToggleSaved();
  const archiveOpportunityMutation = useArchiveOpportunity();
  const pursueOpportunityMutation = usePursueOpportunity();


  const isSaved = (opportunity.userSaves || []).includes(userId);
  const isArchived = (opportunity.archived || {})[userId] != null;
  const hasBeenSeen = (opportunity.seenBy || {})[userId] != null;
  const seenByUsers = Object.keys(opportunity.seenBy || {});
  const isPursued = opportunity.pursued === true;

// Debug logging - add this temporarily
  console.log('OpportunityCard Debug:', {
  userId,
  opportunityId: opportunity.id,
  isSaved,
  isArchived,
  hasBeenSeen,
  seenByUsers
  });

  const handleCardExpanded = () => {
    // Mark as seen when card is opened
    console.log('Card expanded!', { opportunityId: opportunity.id, userId, hasBeenSeen });
    if (showSeenTracking &&!hasBeenSeen) {
      markSeenMutation.mutate({ opportunityId: opportunity.id, userId });
    }
    onToggleExpanded?.();
  };

  const handleArchive = () => {
    console.log('Archive button clicked!', { opportunityId: opportunity.id, userId });
    archiveOpportunityMutation.mutate({ opportunityId: opportunity.id, userId });
  };

  const handleToggleSaved = () => {
    console.log('Save button clicked!', { opportunityId: opportunity.id, userId });
    toggleSavedMutation.mutate({ opportunityId: opportunity.id, userId });
  };

  const handleCopySolicitation = async () => {
    if (opportunity.solicitationNumber) {
      try {
        await navigator.clipboard.writeText(opportunity.solicitationNumber);
        setCopiedSolicitation(true);
        setTimeout(() => setCopiedSolicitation(false), 2000);
      } catch (err) {
        console.error('Failed to copy solicitation number');
      }
    }
  };
  
  const handlePursue = () => {
    pursueOpportunityMutation.mutate({ opportunityId: opportunity.id, userId });
  };

  const formatCurrency = (value: number) => {
    const actualValue = value * 1000; // Convert from thousands
    
    if (actualValue >= 1000000000) {
      return `$${(actualValue / 1000000000).toFixed(1)}B`;
    } else if (actualValue >= 1000000) {
      return `$${(actualValue / 1000000).toFixed(1)}M`;
    } else if (actualValue >= 1000) {
      return `$${(actualValue / 1000).toFixed(1)}K`;
    }
    return `$${actualValue.toLocaleString()}`;
  };

  const getStatusColor = (status: string) => {
    if (!status) {
      return 'bg-gray-100 text-gray-800';
    }
    
    switch (status.toLowerCase()) {
      case 'pre-rfp': return 'bg-blue-100 text-blue-800';
      case 'post-rfp': return 'bg-green-100 text-green-800';
      case 'awarded': return 'bg-gray-100 text-gray-800';
      case 'source selection': return 'bg-purple-100 text-purple-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'Unknown';
    try {
      return format(parseISO(dateString), 'yyyy-MM-dd HH:mm:ss');
    } catch {
      return dateString;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown';
    try {
      return format(parseISO(dateString), 'MMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${hasBeenSeen ? 'opacity-75' : ''}`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <button
              onClick={handleCardExpanded}
              className="text-left w-full group"
            >
              <h3 className="font-semibold text-lg leading-tight group-hover:text-blue-600 transition-colors mb-2">
                {opportunity.title}
              </h3>
            </button>
            
            {/* Contract Value and Status Row */}
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <span className="font-bold text-lg text-green-600">
                {formatCurrency(opportunity.contractValue || 0)}
              </span>
              <Badge variant="outline" className={getStatusColor(opportunity.status)}>
                {opportunity.status || 'Unknown Status'}
              </Badge>
              <Badge variant="outline">
                {opportunity.source}
              </Badge>
              {opportunity.typeOfAward && opportunity.typeOfAward !== 'Other' && (
                <Badge variant="outline" className="bg-purple-100 text-purple-800">
                  {opportunity.typeOfAward}
                </Badge>
              )}
            </div>

            {/* seenBy Tags */}
            <div className="flex items-center gap-2 mb-2">
              <Users size={14} className="text-gray-500" />
              <span className="text-xs text-gray-500">Seen by:</span>
              <div className="flex flex-wrap gap-1">
                {seenByUsers.length === 0 ? (
                  <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5 text-gray-400">
                    Not seen
                  </Badge>
                ) : (
                  <>
                    {seenByUsers.slice(0, 3).map((seenUserId) => (
                      <Badge 
                        key={seenUserId} 
                        variant="outline" 
                        className="text-xs px-1.5 py-0.5 h-5"
                      >
                        {seenUserId === userId ? "You" : seenUserId.slice(0, 8)}
                      </Badge>
                    ))}
                    {seenByUsers.length > 3 && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5">
                        +{seenByUsers.length - 3} more
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Archive button */}
            <Button
                variant={isArchived ? "default" : "ghost"}
                size="sm"
                onClick={handleArchive}
                disabled={archiveOpportunityMutation.isPending}
                className={isArchived ? 'bg-red-600 hover:bg-red-700 text-white' : 'text-gray-500 hover:text-red-600'}
            >
                <Archive size={20} />
            </Button>

            {/* Save button - only show on dashboard */}
            {pageType === 'dashboard' && (
            <Button
                variant={isSaved ? "default" : "ghost"}
                size="sm"
                onClick={handleToggleSaved}
                disabled={toggleSavedMutation.isPending}
                className={isSaved ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'text-gray-500 hover:text-yellow-600'}
            >
                {isSaved ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
            </Button>
            )}
            {/* Pursue button - only show if showPursueButton is true */}
            {showPursueButton && (
            <Button
                variant={isPursued ? "default" : "ghost"}
                size="sm"
                onClick={handlePursue}
                disabled={pursueOpportunityMutation.isPending}
                className={isPursued ? 'bg-green-600 hover:bg-green-700 text-white' : 'text-gray-500 hover:text-green-600'}
            >
                <Target size={20} />
            </Button>
            )}
            </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Detailed Information - Only show when expanded */}
        {isExpanded && (
          <div className="space-y-3 mb-4">
            {/* Agency */}
            {opportunity.govEntity?.title && (
              <div className="flex items-start gap-2">
                <Building size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-gray-700">Agency:</span>
                  <span className="ml-2">{opportunity.govEntity.title}</span>
                </div>
              </div>
            )}

            {/* Classification Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-start gap-2 mb-2">
                  <Tag size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-gray-700">PSC:</span>
                    <span className="ml-2">{opportunity.classificationCodeDesc || 'N/A'}</span>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <Tag size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-gray-700">NAICS:</span>
                    <span className="ml-2">
                      {opportunity.primaryNAICS.id} – {opportunity.primaryNAICS.title}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                {/* Response Deadline */}
                {(opportunity.responseDate?.value || opportunity.dueDate) && (
                  <div className="flex items-start gap-2 mb-2">
                    <Clock size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-gray-700">Response Deadline:</span>
                      <span className="ml-2">
                        {opportunity.responseDate?.value 
                          ? format(parseISO(opportunity.responseDate.value), 'M/d/yyyy HH:mm')
                          : opportunity.dueDate 
                            ? format(parseISO(opportunity.dueDate), 'M/d/yyyy HH:mm')
                            : 'Unknown'
                        }
                      </span>
                    </div>
                  </div>
                )}

                {/* Set-Asides */}
                <div className="flex items-start gap-2">
                  <FileText size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-gray-700">Set-Asides:</span>
                    <span className="ml-2">
                      {opportunity.setAsides && opportunity.setAsides.length > 0 
                        ? opportunity.setAsides.map(sa => typeof sa === 'string' ? sa : sa.title).join(', ')
                        : 'N/A'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dates Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-blue-600 flex-shrink-0" />
                  <span className="font-medium text-gray-700">Posted:</span>
                  <span>{opportunity.partitionDate ? format(new Date(opportunity.partitionDate), 'M/d/yyyy') : 'Unknown'}</span>
              </div>
              
              <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-red-600 flex-shrink-0" />
                  <span className="font-medium text-gray-700">Due Date:</span>
                  <span>
                  {opportunity.responseDate?.value 
                      ? format(parseISO(opportunity.responseDate.value), 'M/d/yyyy')
                      : opportunity.dueDate 
                      ? format(parseISO(opportunity.dueDate), 'M/d/yyyy')
                      : 'Unknown'
                  }
                  </span>
              </div>
            </div>

            {/* Solicitation Number with Copy */}
            {opportunity.solicitationNumber && (
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-gray-500 flex-shrink-0" />
                <span className="font-medium text-gray-700">Solicitation #:</span>
                <span className="font-mono">{opportunity.solicitationNumber}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopySolicitation}
                  className="h-6 w-6 p-0"
                >
                  {copiedSolicitation ? (
                    <Check size={14} className="text-green-600" />
                  ) : (
                    <Copy size={14} className="text-gray-500" />
                  )}
                </Button>
              </div>
            )}

            {/* Search Term */}
            {opportunity.searchTerm && (
              <div className="flex items-center gap-2">
                <Tag size={16} className="text-blue-500 flex-shrink-0" />
                <span className="font-medium text-gray-700">Search Term:</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  {opportunity.searchTerm}
                </Badge>
              </div>
            )}

            {/* Primary Tags */}
            {opportunity.smartTag && (
              <div className="flex items-start gap-2">
                <Tag size={16} className="text-purple-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-gray-700">Primary Tags:</span>
                  <span className="ml-2 text-sm">{opportunity.smartTag}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Description - Only visible when expanded, scrollable */}
        {isExpanded && opportunity.description && (
          <div className="border-t pt-4 mb-4">
            <h4 className="font-medium text-gray-700 mb-2">Description</h4>
            <div 
              className="text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none max-h-32 overflow-y-auto border border-gray-200 rounded p-3 bg-gray-50"
              dangerouslySetInnerHTML={{ __html: opportunity.description }}
            />
          </div>
        )}

        {/* View Source Button - Bottom Left */}
        {opportunity.sourceURL && (
          <div className="border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(opportunity.sourceURL, '_blank')}
              className="flex items-center gap-2"
            >
              <ExternalLink size={16} />
              View Source
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}