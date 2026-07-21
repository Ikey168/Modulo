import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  RefreshCw,
  Upload,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Separator,
  Skeleton,
  cn,
  useToast,
  type BadgeProps,
} from '@/ui';
import { submissionService, PluginSubmission as ImportedPluginSubmission } from '../services/SubmissionService';

type PluginSubmission = ImportedPluginSubmission;

interface StatusConfig {
  label: string;
  variant: NonNullable<BadgeProps['variant']>;
  icon: LucideIcon;
}

/** Single status → Badge-variant map; tokens only, works in light and dark themes. */
const STATUS_CONFIG: Record<string, StatusConfig> = {
  PENDING_REVIEW: { label: 'Pending Review', variant: 'warning', icon: Clock },
  IN_REVIEW: { label: 'In Review', variant: 'info', icon: Eye },
  UNDER_REVIEW: { label: 'Under Review', variant: 'info', icon: Eye },
  VALIDATION_FAILED: { label: 'Validation Failed', variant: 'destructive', icon: AlertTriangle },
  CHANGES_REQUESTED: { label: 'Changes Requested', variant: 'warning', icon: AlertCircle },
  APPROVED: { label: 'Approved', variant: 'success', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', variant: 'destructive', icon: XCircle },
  WITHDRAWN: { label: 'Withdrawn', variant: 'outline', icon: X },
  PUBLISHED: { label: 'Published', variant: 'secondary', icon: CheckCircle2 },
};

const statusConfigFor = (status: string): StatusConfig =>
  STATUS_CONFIG[status] ?? { label: status, variant: 'outline', icon: Clock };

function StatusBadge({ status }: { status: string }) {
  const { label, variant, icon: Icon } = statusConfigFor(status);
  return (
    <Badge variant={variant}>
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * What the submission ships as: the container image reference for image-based
 * submissions, or the JAR file name for legacy uploads.
 */
const artifactLabelOf = (submission: PluginSubmission): string | null => {
  if (submission.imageReference) return submission.imageReference;
  if (submission.jarFilePath) return submission.jarFilePath.split(/[\\/]/).pop() ?? null;
  return null;
};

/** Ordered list of lifecycle timestamps present on a submission. */
const timelineOf = (submission: PluginSubmission): Array<{ label: string; date: string }> => {
  const entries = [{ label: 'Submitted', date: submission.submittedAt }];
  if (submission.reviewStartedAt) entries.push({ label: 'Review Started', date: submission.reviewStartedAt });
  if (submission.approvedAt) entries.push({ label: 'Approved', date: submission.approvedAt });
  if (submission.rejectedAt) entries.push({ label: 'Rejected', date: submission.rejectedAt });
  if (submission.publishedAt) entries.push({ label: 'Published', date: submission.publishedAt });
  return entries;
};

function ValidationCheck({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-xs font-medium',
        passed ? 'text-success' : 'text-destructive',
      )}
    >
      {passed ? <Check className="size-3.5" aria-hidden="true" /> : <X className="size-3.5" aria-hidden="true" />}
      <span>
        {label} {passed ? 'passed' : 'failed'}
      </span>
    </div>
  );
}

export default function MySubmissions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<PluginSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<PluginSubmission | null>(null);

  // Mock user email - in real app, get from auth context
  const userEmail = 'developer@example.com';

  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSubmissions = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await submissionService.getSubmissionsByDeveloper(userEmail);

      if (result.data) {
        setSubmissions(result.data);
      } else {
        setError(result.error || 'Failed to load submissions');
      }
    } catch (err) {
      console.error('Error fetching submissions:', err);
      setError('Failed to load submissions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResubmit = (submission: PluginSubmission) => {
    // Navigate to submission form with pre-filled data for resubmission
    navigate('/plugins/submit', {
      state: {
        resubmit: true,
        submissionId: submission.submissionId,
        formData: {
          pluginName: submission.pluginName,
          version: submission.version,
          description: submission.description,
          category: submission.category,
          developerName: submission.developerName,
          developerEmail: submission.developerEmail,
        },
        // Pre-fill image coordinates (digest is intentionally omitted: a
        // resubmission must pin a fresh build).
        image: submission.imageReference
          ? {
              imageReference: submission.imageReference,
              requiredPermissions: submission.requiredPermissions ?? [],
            }
          : undefined,
      },
    });
  };

  const handleDelete = async (submissionId: string) => {
    if (!confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await submissionService.deleteSubmission(submissionId);

      if (!result.error) {
        setSubmissions(submissions.filter((s) => s.submissionId !== submissionId));
        toast({ title: 'Submission deleted', description: 'The submission has been removed.' });
      } else {
        toast({ variant: 'destructive', title: 'Delete failed', description: result.error });
      }
    } catch (err) {
      console.error('Error deleting submission:', err);
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: 'Failed to delete submission. Please try again.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl animate-fade-in space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Plugin Submissions</h1>
            <p className="text-[13px] text-muted-foreground">
              Track the status of your submitted plugins and manage resubmissions.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchSubmissions} disabled={loading}>
              <RefreshCw aria-hidden="true" />
              Refresh
            </Button>
            <Button onClick={() => navigate('/plugins/submit')}>
              <Upload aria-hidden="true" />
              Submit New Plugin
            </Button>
          </div>
        </header>

        {loading ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading your submissions">
            {[0, 1, 2].map((i) => (
              <Card key={i}>
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-3.5 w-28" />
                  </div>
                  <Skeleton className="h-5 w-24 rounded-full" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Failed to Load Submissions</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={fetchSubmissions}>
                <RefreshCw aria-hidden="true" />
                Try Again
              </Button>
            </AlertDescription>
          </Alert>
        ) : submissions.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Upload aria-hidden="true" />}
              title="No Submissions Yet"
              description="You haven't submitted any plugins yet. Share your work with the Modulo community!"
              action={<Button onClick={() => navigate('/plugins/submit')}>Submit Your First Plugin</Button>}
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => (
              <Card key={submission.submissionId}>
                <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-base">
                      {submission.pluginName}{' '}
                      <span className="font-normal text-muted-foreground">v{submission.version}</span>
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{submission.category || 'Uncategorized'}</span>
                      <span aria-hidden="true">·</span>
                      {artifactLabelOf(submission) ? (
                        <span className="break-all font-mono">{artifactLabelOf(submission)}</span>
                      ) : (
                        <span>{formatFileSize(submission.fileSize)}</span>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={submission.status} />
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="text-[13px] text-muted-foreground">{submission.description}</p>

                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    {timelineOf(submission).map(({ label, date }) => (
                      <span key={label}>
                        <span className="font-medium text-foreground">{label}:</span> {formatDate(date)}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <ValidationCheck label="Security Check" passed={submission.securityCheckPassed} />
                    <ValidationCheck label="Compatibility Check" passed={submission.compatibilityCheckPassed} />
                  </div>

                  {submission.reviewNotes && (
                    <Alert variant="info">
                      <AlertCircle className="size-4" />
                      <AlertTitle>Review Notes</AlertTitle>
                      <AlertDescription>{submission.reviewNotes}</AlertDescription>
                    </Alert>
                  )}

                  {submission.validationErrors && (
                    <Alert variant="destructive">
                      <XCircle className="size-4" />
                      <AlertTitle>Validation Errors</AlertTitle>
                      <AlertDescription>{submission.validationErrors}</AlertDescription>
                    </Alert>
                  )}

                  {submission.validationWarnings && (
                    <Alert variant="warning">
                      <AlertTriangle className="size-4" />
                      <AlertTitle>Validation Warnings</AlertTitle>
                      <AlertDescription>{submission.validationWarnings}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>

                <CardFooter className="flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button variant="outline" size="sm" onClick={() => setSelectedSubmission(submission)}>
                    <Eye aria-hidden="true" />
                    View Details
                  </Button>

                  {['REJECTED', 'VALIDATION_FAILED', 'CHANGES_REQUESTED'].includes(submission.status) && (
                    <Button variant="secondary" size="sm" onClick={() => handleResubmit(submission)}>
                      <Upload aria-hidden="true" />
                      Resubmit
                    </Button>
                  )}

                  {submission.status === 'PUBLISHED' && (
                    <Button
                      size="sm"
                      onClick={() => navigate(`/plugins/marketplace?plugin=${submission.submissionId}`)}
                    >
                      View in Marketplace
                    </Button>
                  )}

                  {(submission.status === 'PENDING_REVIEW' || submission.status === 'REJECTED') && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(submission.submissionId)}
                    >
                      Delete
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* Submission details dialog */}
        <Dialog
          open={selectedSubmission !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedSubmission(null);
          }}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
            {selectedSubmission && (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {selectedSubmission.pluginName} v{selectedSubmission.version}
                  </DialogTitle>
                  <DialogDescription>Full submission details and review timeline.</DialogDescription>
                </DialogHeader>

                <div className="space-y-5 text-[13px]">
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-foreground">Submission Details</h3>
                    <dl className="grid gap-3 rounded-lg border border-border bg-surface-2 p-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">Submission ID</dt>
                        <dd className="mt-0.5 break-all font-mono text-foreground">
                          {selectedSubmission.submissionId}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Category</dt>
                        <dd className="mt-0.5 text-foreground">
                          {selectedSubmission.category || 'Uncategorized'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">File Size</dt>
                        <dd className="mt-0.5 text-foreground">{formatFileSize(selectedSubmission.fileSize)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Checksum</dt>
                        <dd className="mt-0.5 break-all font-mono text-foreground">
                          {selectedSubmission.checksum}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-foreground">Description</h3>
                    <p className="text-muted-foreground">{selectedSubmission.description}</p>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-foreground">Timeline</h3>
                    <ul className="space-y-1.5">
                      {timelineOf(selectedSubmission).map(({ label, date }) => (
                        <li key={label} className="text-muted-foreground">
                          <span className="font-medium text-foreground">{label}:</span> {formatDate(date)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
