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
  ArchiveRestore,
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
  showSeenTracking = true,
  showPursueButton = false,
  pageType = 'dashboard'
}: OpportunityCardProps) {
  const [copiedSolicitation, setCopiedSolicitation] = useState(false);
  const markSeenMutation = useMarkSeen();
  const toggleSavedMutation = useToggleSaved();
  const archiveOpportunityMutation = useArchiveOpportunity();
  const pursueOpportunityMutation = usePursueOpportunity();

  // 🆕 NEW: Use the improved data model
  const isSaved = (opportunity.userSaves || []).includes(userId);
  const isArchived = (opportunity.archived || {})[userId] != null;
  const isPursued = (opportunity.pursued || {})[userId] != null;
  const hasBeenSeen = (opportunity.seenBy || {})[userId] != null;
  const seenByUsers = Object.keys(opportunity.seenBy || {});

  // Debug logging - remove after testing
  console.log('OpportunityCard Debug:', {
    userId,
    opportunityId: opportunity.id,
    isSaved,
    isArchived,
    isPursued,
    hasBeenSeen,
    seenByUsers,
    relevant: opportunity.relevant
  });

  const handleCardExpanded = () => {
    console.log('Card expanded!', { opportunityId: opportunity.id, userId, hasBeenSeen });
    if (showSeenTracking && !hasBeenSeen) {
      markSeenMutation.mutate({ 
        opportunityId: opportunity.id, 
        userId,
        partitionDate: opportunity.partitionDate 
      });
    }
    onToggleExpanded?.();
  };

  const handleArchive = () => {
    console.log('Archive button clicked!', { opportunityId: opportunity.id, userId, currentlyArchived: isArchived });
    archiveOpportunityMutation.mutate({ 
      opportunityId: opportunity.id, 
      userId,
      partitionDate: opportunity.partitionDate 
    });
  };

  const handleToggleSaved = () => {
    console.log('Save button clicked!', { opportunityId: opportunity.id, userId, currentlySaved: isSaved });
    toggleSavedMutation.mutate({ 
      opportunityId: opportunity.id, 
      userId,
      partitionDate: opportunity.partitionDate 
    });
  };

  const handlePursue = () => {
    console.log('Pursue button clicked!', { opportunityId: opportunity.id, userId, currentlyPursued: isPursued });
    pursueOpportunityMutation.mutate({ 
      opportunityId: opportunity.id, 
      userId,
      partitionDate: opportunity.partitionDate 
    });
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

  // 🆕 NEW: Visual indicators for combined states
  const getCardBorderClass = () => {
    if (isPursued) return 'border-green-300 bg-green-50';
    if (isArchived) return 'border-red-300 bg-red-50';
    if (isSaved) return 'border-yellow-300 bg-yellow-50';
    if (hasBeenSeen) return 'border-gray-200 bg-gray-50';
    return 'border-blue-200 bg-white';
  };

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${getCardBorderClass()}`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className={getStatusColor(opportunity.status)}>
                {opportunity.status || 'Unknown'}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {opportunity.source}
              </Badge>
              {opportunity.contractValue && (
                <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200">
                  <DollarSign className="w-3 h-3 mr-1" />
                  {formatCurrency(opportunity.contractValue)}
                </Badge>
              )}
              
              {/* 🆕 NEW: Status indicators */}
              {isPursued && (
                <Badge className="bg-green-600 text-white text-xs">
                  Pursuing
                </Badge>
              )}
              {isArchived && (
                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 text-xs">
                  Archived
                </Badge>
              )}
            </div>
            
            <h3 className="font-semibold text-lg leading-tight text-gray-900 mb-2 cursor-pointer hover:text-blue-600" 
                onClick={handleCardExpanded}>
              {opportunity.title}
            </h3>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>Posted: {formatDate(opportunity.postedDate)}</span>
              </div>
              {opportunity.dueDate && (
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>Due: {formatDate(opportunity.dueDate)}</span>
                </div>
              )}
              {opportunity.primaryNAICS?.id && (
                <div className="flex items-center gap-1">
                  <Tag className="w-4 h-4" />
                  <span>NAICS: {opportunity.primaryNAICS.id}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* 🆕 NEW: Improved User Actions */}
          <div className="flex items-start gap-2">
            {/* Archive/Unarchive button */}
            <Button
              variant={isArchived ? "default" : "ghost"}
              size="sm"
              onClick={handleArchive}
              disabled={archiveOpportunityMutation.isPending}
              className={isArchived 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'text-gray-500 hover:text-red-600'
              }
              title={isArchived ? "Unarchive opportunity" : "Archive opportunity"}
            >
              {isArchived ? <ArchiveRestore size={20} /> : <Archive size={20} />}
            </Button>

            {/* Save button - show on dashboard or if already saved */}
            {(pageType === 'dashboard' || isSaved) && (
              <Button
                variant={isSaved ? "default" : "ghost"}
                size="sm"
                onClick={handleToggleSaved}
                disabled={toggleSavedMutation.isPending}
                className={isSaved 
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white' 
                  : 'text-gray-500 hover:text-yellow-600'
                }
                title={isSaved ? "Remove from saved" : "Save opportunity"}
              >
                {isSaved ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
              </Button>
            )}

            {/* Pursue button - show if enabled */}
            {showPursueButton && (
              <Button
                variant={isPursued ? "default" : "ghost"}
                size="sm"
                onClick={handlePursue}
                disabled={pursueOpportunityMutation.isPending}
                className={isPursued 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'text-gray-500 hover:text-green-600'
                }
                title={isPursued ? "Stop pursuing" : "Mark as pursuing"}
              >
                <Target size={20} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-4">
            {/* Description */}
            {opportunity.description && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  Description
                </h4>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {opportunity.description}
                </p>
              </div>
            )}

            {/* Agency & Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {opportunity.agency && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-1 flex items-center gap-1">
                    <Building className="w-4 h-4" />
                    Agency
                  </h4>
                  <p className="text-gray-700 text-sm">{opportunity.agency}</p>
                </div>
              )}

              {opportunity.officeLocation && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Office Location</h4>
                  <p className="text-gray-700 text-sm">{opportunity.officeLocation}</p>
                </div>
              )}
            </div>

            {/* NAICS Codes */}
            {opportunity.allNAICSCodes && opportunity.allNAICSCodes.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">NAICS Codes</h4>
                <div className="flex flex-wrap gap-2">
                  {opportunity.allNAICSCodes.map((naics, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {naics}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Set Asides */}
            {opportunity.setAsides && opportunity.setAsides.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Set Asides</h4>
                <div className="flex flex-wrap gap-2">
                  {opportunity.setAsides.map((setAside, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {setAside}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Info */}
            {opportunity.contactInfo && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Contact Information</h4>
                <div className="text-sm text-gray-700 space-y-1">
                  {opportunity.contactInfo.name && (
                    <div><strong>Name:</strong> {opportunity.contactInfo.name}</div>
                  )}
                  {opportunity.contactInfo.email && (
                    <div><strong>Email:</strong> {opportunity.contactInfo.email}</div>
                  )}
                  {opportunity.contactInfo.phone && (
                    <div><strong>Phone:</strong> {opportunity.contactInfo.phone}</div>
                  )}
                </div>
              </div>
            )}

            {/* Solicitation Number */}
            {opportunity.solicitationNumber && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Solicitation Number</h4>
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                    {opportunity.solicitationNumber}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopySolicitation}
                    className="h-6 w-6 p-0"
                  >
                    {copiedSolicitation ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Source URL */}
            {opportunity.sourceURL && (
              <div>
                <a
                  href={opportunity.sourceURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Original Posting
                </a>
              </div>
            )}

            {/* 🆕 NEW: Enhanced tracking info */}
            {showSeenTracking && (
              <div className="border-t pt-3 mt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-600">
                  {seenByUsers.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      <span>{seenByUsers.length} viewed</span>
                    </div>
                  )}
                  {Object.keys(opportunity.userSaves || {}).length > 0 && (
                    <div className="flex items-center gap-1">
                      <Bookmark className="w-3 h-3" />
                      <span>{(opportunity.userSaves || []).length} saved</span>
                    </div>
                  )}
                  {Object.keys(opportunity.archived || {}).length > 0 && (
                    <div className="flex items-center gap-1">
                      <Archive className="w-3 h-3" />
                      <span>{Object.keys(opportunity.archived || {}).length} archived</span>
                    </div>
                  )}
                  {Object.keys(opportunity.pursued || {}).length > 0 && (
                    <div className="flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      <span>{Object.keys(opportunity.pursued || {}).length} pursuing</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="border-t pt-3 mt-4 text-xs text-gray-500 space-y-1">
              <div>Search Term: {opportunity.searchTerm}</div>
              <div>Ingested: {formatDateTime(opportunity.ingestedAt)}</div>
              {opportunity.updateDate && (
                <div>Updated: {formatDateTime(opportunity.updateDate)}</div>
              )}
              {opportunity.relevant !== null && (
                <div>
                  Business Relevance: {opportunity.relevant ? '✅ Relevant' : '❌ Not Relevant'}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}