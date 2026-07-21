import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Textarea,
  cn,
  useToast,
} from '@/ui';
import { submissionService, SubmissionFormData as ImportedSubmissionFormData } from '../services/SubmissionService';
import {
  KNOWN_PERMISSIONS,
  validateImageDigest,
  validateImageReference,
} from './pluginImageValidation';

type SubmissionFormData = ImportedSubmissionFormData;

interface SubmissionResponse {
  submissionId: string;
  status: string;
  pluginName: string;
  version: string;
  submittedAt: string;
  imageReference?: string;
}

const EXTERNAL_PLUGINS_DOC_URL =
  'https://github.com/Ikey168/Modulo/blob/main/docs/deploying-external-plugins.md';

const CATEGORIES = [
  'Development Tools',
  'Code Quality',
  'Testing',
  'Documentation',
  'UI/UX',
  'Data Analysis',
  'Security',
  'Integration',
  'Productivity',
  'Other',
];

const LICENSE_TYPES = [
  'MIT',
  'Apache 2.0',
  'GPL v3',
  'BSD 3-Clause',
  'ISC',
  'Mozilla Public License 2.0',
  'Creative Commons',
  'Proprietary',
  'Other',
];

/** Radix SelectItem forbids value=""; sentinel mapped back to '' in form state. */
const NONE_VALUE = 'none';

interface Step {
  id: string;
  title: string;
  description: string;
  /** Form fields validated by this step (used for per-step gating and error jumps). */
  fields: string[];
}

const STEPS: Step[] = [
  {
    id: 'basics',
    title: 'Basic Information',
    description: 'Name, version and what your plugin does.',
    fields: ['pluginName', 'version', 'description', 'category', 'licenseType', 'tags'],
  },
  {
    id: 'developer',
    title: 'Developer',
    description: 'Who maintains this plugin and where to learn more.',
    fields: ['developerName', 'developerEmail', 'homepageUrl', 'documentationUrl'],
  },
  {
    id: 'compatibility',
    title: 'Compatibility',
    description: 'Supported Modulo platform version range (optional).',
    fields: ['minPlatformVersion', 'maxPlatformVersion'],
  },
  {
    id: 'image',
    title: 'Container Image',
    description: 'Where your plugin image lives and the exact digest to run.',
    fields: ['imageReference', 'imageDigest'],
  },
];

const ALL_FIELDS = STEPS.flatMap((step) => step.fields);

const EMPTY_FORM: SubmissionFormData = {
  pluginName: '',
  version: '',
  description: '',
  category: '',
  developerName: '',
  developerEmail: '',
  homepageUrl: '',
  documentationUrl: '',
  licenseType: '',
  tags: '',
  minPlatformVersion: '',
  maxPlatformVersion: '',
};

export default function PluginSubmission() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Check if this is a resubmission
  const resubmitData = location.state as {
    resubmit?: boolean;
    submissionId?: string;
    formData?: Partial<SubmissionFormData>;
    image?: { imageReference?: string; requiredPermissions?: string[] };
  } | null;

  const [formData, setFormData] = useState<SubmissionFormData>({
    ...EMPTY_FORM,
    ...Object.fromEntries(
      Object.entries(resubmitData?.formData ?? {}).filter(([, value]) => value != null),
    ),
  });

  const [step, setStep] = useState(0);
  const [imageReference, setImageReference] = useState(resubmitData?.image?.imageReference ?? '');
  // The digest is never pre-filled: a resubmission must pin a fresh image build.
  const [imageDigest, setImageDigest] = useState('');
  const [requiredPermissions, setRequiredPermissions] = useState<string[]>(
    resubmitData?.image?.requiredPermissions ?? [],
  );
  const [customPermission, setCustomPermission] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResponse | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearFieldError = (name: string) => {
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const newErrors = { ...prev };
      delete newErrors[name];
      return newErrors;
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearFieldError(name);
  };

  const handleSelectChange = (name: keyof SubmissionFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value === NONE_VALUE ? '' : value }));
    clearFieldError(name);
  };

  const togglePermission = (permission: string) => {
    setRequiredPermissions((prev) =>
      prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission],
    );
  };

  const addCustomPermission = () => {
    const permission = customPermission.trim();
    if (!permission) return;
    setRequiredPermissions((prev) => (prev.includes(permission) ? prev : [...prev, permission]));
    setCustomPermission('');
  };

  /** Custom (free-entry) permissions are rendered as removable badges. */
  const customPermissions = requiredPermissions.filter((p) => !KNOWN_PERMISSIONS.includes(p));

  /** Validation rules for a subset of fields; the union of all subsets is the full form check. */
  const validateFields = (fields: string[]): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    if (fields.includes('pluginName') && !formData.pluginName.trim()) {
      newErrors.pluginName = 'Plugin name is required';
    }

    if (fields.includes('version')) {
      if (!formData.version.trim()) {
        newErrors.version = 'Version is required';
      } else if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/.test(formData.version)) {
        newErrors.version = 'Version must follow semantic versioning (e.g., 1.0.0)';
      }
    }

    if (fields.includes('description') && !formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (fields.includes('developerName') && !formData.developerName.trim()) {
      newErrors.developerName = 'Developer name is required';
    }

    if (fields.includes('developerEmail')) {
      if (!formData.developerEmail.trim()) {
        newErrors.developerEmail = 'Developer email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.developerEmail)) {
        newErrors.developerEmail = 'Please enter a valid email address';
      }
    }

    if (fields.includes('imageReference')) {
      const referenceError = validateImageReference(imageReference);
      if (referenceError) newErrors.imageReference = referenceError;
    }

    if (fields.includes('imageDigest')) {
      const digestError = validateImageDigest(imageDigest);
      if (digestError) newErrors.imageDigest = digestError;
    }

    if (fields.includes('homepageUrl') && formData.homepageUrl && !formData.homepageUrl.match(/^https?:\/\/.+/)) {
      newErrors.homepageUrl = 'Homepage URL must start with http:// or https://';
    }

    if (
      fields.includes('documentationUrl') &&
      formData.documentationUrl &&
      !formData.documentationUrl.match(/^https?:\/\/.+/)
    ) {
      newErrors.documentationUrl = 'Documentation URL must start with http:// or https://';
    }

    return newErrors;
  };

  /** First wizard step containing one of the given error keys (for jump-to-error). */
  const firstStepWithError = (errorKeys: string[]): number => {
    const index = STEPS.findIndex((s) => s.fields.some((field) => errorKeys.includes(field)));
    return index === -1 ? step : index;
  };

  const goBack = () => setStep((prev) => Math.max(0, prev - 1));

  const goNext = () => {
    const stepErrors = validateFields(STEPS[step].fields);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length === 0) {
      setStep((prev) => Math.min(STEPS.length - 1, prev + 1));
    }
  };

  const submitPlugin = async () => {
    const newErrors = validateFields(ALL_FIELDS);
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setStep(firstStepWithError(Object.keys(newErrors)));
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      // EXTERNAL-only policy: every submission (including resubmissions of
      // rejected plugins) goes through the container-image endpoint. JAR
      // uploads are rejected by the backend.
      const result = await submissionService.submitImagePlugin({
        ...formData,
        imageReference: imageReference.trim(),
        imageDigest: imageDigest.trim(),
        requiredPermissions,
      });

      if (result.data) {
        setSubmissionResult(result.data);
        toast({
          title: 'Plugin submitted',
          description: `${result.data.pluginName} v${result.data.version} is queued for validation and review.`,
        });
      } else {
        if (result.errors) {
          setErrors(result.errors);
          setStep(firstStepWithError(Object.keys(result.errors)));
        } else {
          setErrors({ general: result.error || 'Submission failed' });
        }
        toast({
          variant: 'destructive',
          title: 'Submission failed',
          description: result.error || 'Please review the highlighted fields and try again.',
        });
      }
    } catch (error) {
      console.error('Submission error:', error);
      setErrors({ general: 'Network error occurred. Please try again.' });
      toast({
        variant: 'destructive',
        title: 'Submission failed',
        description: 'Network error occurred. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Enter on an intermediate step advances the wizard instead of submitting.
    if (step < STEPS.length - 1) {
      goNext();
      return;
    }
    void submitPlugin();
  };

  const handleNewSubmission = () => {
    setSubmissionResult(null);
    setFormData({ ...EMPTY_FORM });
    setImageReference('');
    setImageDigest('');
    setRequiredPermissions([]);
    setCustomPermission('');
    setErrors({});
    setStep(0);
  };

  const fieldError = (name: string) =>
    errors[name] ? (
      <p id={`${name}-error`} role="alert" className="text-xs text-destructive">
        {errors[name]}
      </p>
    ) : null;

  const errorProps = (name: string) => ({
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
    className: errors[name] ? 'border-destructive/60' : undefined,
  });

  if (submissionResult) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-2xl animate-fade-in">
          <Card>
            <CardHeader className="items-center text-center">
              <CheckCircle2 className="mb-2 size-10 text-success" aria-hidden="true" />
              <CardTitle className="text-xl">Plugin submitted successfully</CardTitle>
              <CardDescription>
                Your submission has been received and is queued for validation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <dl className="grid gap-3 rounded-lg border border-border bg-surface-2 p-4 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Submission ID</dt>
                  <dd className="mt-0.5 break-all font-mono text-foreground">{submissionResult.submissionId}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Plugin</dt>
                  <dd className="mt-0.5 text-foreground">
                    {submissionResult.pluginName} v{submissionResult.version}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="mt-1">
                    <Badge variant="warning">{submissionResult.status}</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Submitted</dt>
                  <dd className="mt-0.5 text-foreground">
                    {new Date(submissionResult.submittedAt).toLocaleString()}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Container Image</dt>
                  <dd className="mt-0.5 break-all font-mono text-foreground">
                    {submissionResult.imageReference ?? imageReference}
                  </dd>
                </div>
              </dl>

              <Separator />

              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">What happens next?</h3>
                <ol className="list-decimal space-y-1.5 pl-5 text-[13px] text-muted-foreground">
                  <li>Your container image will undergo automated security and compatibility validation</li>
                  <li>If validation passes, it will be queued for manual review</li>
                  <li>A reviewer will examine your plugin's functionality and code quality</li>
                  <li>You'll receive an email notification about the review outcome</li>
                  <li>Once approved, your plugin will be published to the marketplace</li>
                </ol>
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button onClick={() => navigate('/plugins/my-submissions')}>View My Submissions</Button>
              <Button variant="secondary" onClick={handleNewSubmission}>
                Submit Another Plugin
              </Button>
              <Button variant="outline" onClick={() => navigate('/plugins/marketplace')}>
                Browse Marketplace
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  const currentStep = STEPS[step];
  const progressValue = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl animate-fade-in space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {resubmitData?.resubmit ? 'Resubmit Your Plugin' : 'Submit Your Plugin'}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            Share your plugin with the Modulo community. All submissions undergo security validation and
            manual review.
          </p>
        </header>

        {/* Step indicator */}
        <nav aria-label="Submission steps" className="space-y-3">
          <ol className="flex flex-wrap gap-2">
            {STEPS.map((s, index) => {
              const isCurrent = index === step;
              const isVisitable = index < step;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-current={isCurrent ? 'step' : undefined}
                    disabled={!isCurrent && !isVisitable}
                    onClick={() => isVisitable && setStep(index)}
                    className={cn(
                      'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      isCurrent
                        ? 'border-primary bg-primary/10 text-primary'
                        : isVisitable
                          ? 'border-border-strong bg-surface-2 text-foreground hover:bg-surface-3'
                          : 'border-border bg-surface text-subtle-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-4 items-center justify-center rounded-full text-xxs',
                        isCurrent ? 'bg-primary text-primary-foreground' : 'bg-surface-3 text-muted-foreground',
                      )}
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                    {s.title}
                  </button>
                </li>
              );
            })}
          </ol>
          <Progress value={progressValue} aria-label={`Step ${step + 1} of ${STEPS.length}`} />
        </nav>

        {errors.general && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Submission failed</AlertTitle>
            <AlertDescription>{errors.general}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{currentStep.title}</CardTitle>
              <CardDescription>{currentStep.description}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {currentStep.id === 'basics' && (
                <>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="pluginName">Plugin Name *</Label>
                      <Input
                        id="pluginName"
                        name="pluginName"
                        value={formData.pluginName}
                        onChange={handleInputChange}
                        placeholder="Enter plugin name"
                        {...errorProps('pluginName')}
                      />
                      {fieldError('pluginName')}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="version">Version *</Label>
                      <Input
                        id="version"
                        name="version"
                        value={formData.version}
                        onChange={handleInputChange}
                        placeholder="1.0.0"
                        {...errorProps('version')}
                      />
                      {fieldError('version')}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Describe what your plugin does and its key features"
                      rows={4}
                      {...errorProps('description')}
                    />
                    {fieldError('description')}
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={formData.category || NONE_VALUE}
                        onValueChange={(value) => handleSelectChange('category', value)}
                      >
                        <SelectTrigger id="category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>No category</SelectItem>
                          {CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="licenseType">License</Label>
                      <Select
                        value={formData.licenseType || NONE_VALUE}
                        onValueChange={(value) => handleSelectChange('licenseType', value)}
                      >
                        <SelectTrigger id="licenseType">
                          <SelectValue placeholder="Select a license" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE_VALUE}>No license</SelectItem>
                          {LICENSE_TYPES.map((license) => (
                            <SelectItem key={license} value={license}>
                              {license}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tags">Tags</Label>
                    <Input
                      id="tags"
                      name="tags"
                      value={formData.tags}
                      onChange={handleInputChange}
                      placeholder="tag1, tag2, tag3"
                      aria-describedby="tags-hint"
                    />
                    <p id="tags-hint" className="text-xs text-subtle-foreground">
                      Separate tags with commas to help users discover your plugin
                    </p>
                  </div>
                </>
              )}

              {currentStep.id === 'developer' && (
                <>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="developerName">Name *</Label>
                      <Input
                        id="developerName"
                        name="developerName"
                        value={formData.developerName}
                        onChange={handleInputChange}
                        placeholder="Your name or organization"
                        {...errorProps('developerName')}
                      />
                      {fieldError('developerName')}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="developerEmail">Email *</Label>
                      <Input
                        id="developerEmail"
                        name="developerEmail"
                        type="email"
                        value={formData.developerEmail}
                        onChange={handleInputChange}
                        placeholder="your.email@example.com"
                        {...errorProps('developerEmail')}
                      />
                      {fieldError('developerEmail')}
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="homepageUrl">Homepage URL</Label>
                      <Input
                        id="homepageUrl"
                        name="homepageUrl"
                        type="url"
                        value={formData.homepageUrl}
                        onChange={handleInputChange}
                        placeholder="https://your-plugin-website.com"
                        {...errorProps('homepageUrl')}
                      />
                      {fieldError('homepageUrl')}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="documentationUrl">Documentation URL</Label>
                      <Input
                        id="documentationUrl"
                        name="documentationUrl"
                        type="url"
                        value={formData.documentationUrl}
                        onChange={handleInputChange}
                        placeholder="https://docs.your-plugin.com"
                        {...errorProps('documentationUrl')}
                      />
                      {fieldError('documentationUrl')}
                    </div>
                  </div>
                </>
              )}

              {currentStep.id === 'compatibility' && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="minPlatformVersion">Minimum Platform Version</Label>
                    <Input
                      id="minPlatformVersion"
                      name="minPlatformVersion"
                      value={formData.minPlatformVersion}
                      onChange={handleInputChange}
                      placeholder="1.0.0"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="maxPlatformVersion">Maximum Platform Version</Label>
                    <Input
                      id="maxPlatformVersion"
                      name="maxPlatformVersion"
                      value={formData.maxPlatformVersion}
                      onChange={handleInputChange}
                      placeholder="2.0.0"
                    />
                  </div>
                </div>
              )}

              {currentStep.id === 'image' && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="imageReference">Image Reference *</Label>
                    <Input
                      id="imageReference"
                      name="imageReference"
                      value={imageReference}
                      onChange={(e) => {
                        setImageReference(e.target.value);
                        clearFieldError('imageReference');
                      }}
                      placeholder="ghcr.io/acme/plugin"
                      spellCheck={false}
                      {...errorProps('imageReference')}
                      className={cn('font-mono', errors.imageReference && 'border-destructive/60')}
                      aria-describedby={
                        errors.imageReference ? 'imageReference-error' : 'imageReference-hint'
                      }
                    />
                    {fieldError('imageReference')}
                    <p id="imageReference-hint" className="text-xs text-subtle-foreground">
                      Registry repository (optionally with a tag). Do not include a digest here — it goes
                      in the field below.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="imageDigest">Image Digest *</Label>
                    <Input
                      id="imageDigest"
                      name="imageDigest"
                      value={imageDigest}
                      onChange={(e) => {
                        setImageDigest(e.target.value);
                        clearFieldError('imageDigest');
                      }}
                      placeholder="sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
                      spellCheck={false}
                      {...errorProps('imageDigest')}
                      className={cn('font-mono', errors.imageDigest && 'border-destructive/60')}
                      aria-describedby={errors.imageDigest ? 'imageDigest-error' : 'imageDigest-hint'}
                    />
                    {fieldError('imageDigest')}
                    <p id="imageDigest-hint" className="text-xs text-subtle-foreground">
                      Reviews and deployments are pinned to this exact digest, so a moving tag can never
                      swap the reviewed code. Find yours with{' '}
                      <code className="rounded bg-surface-3 px-1 py-0.5 font-mono">
                        {"docker inspect --format='{{index .RepoDigests 0}}'"}
                      </code>
                    </p>
                  </div>

                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-foreground">Required Permissions</legend>
                    <p className="text-xs text-subtle-foreground">
                      Select every capability your plugin needs at runtime; anything not requested is
                      denied.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {KNOWN_PERMISSIONS.map((permission) => (
                        <div key={permission} className="flex items-center gap-2">
                          <Checkbox
                            id={`permission-${permission}`}
                            checked={requiredPermissions.includes(permission)}
                            onCheckedChange={() => togglePermission(permission)}
                          />
                          <Label
                            htmlFor={`permission-${permission}`}
                            className="font-mono text-xs font-normal"
                          >
                            {permission}
                          </Label>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Input
                        value={customPermission}
                        onChange={(e) => setCustomPermission(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCustomPermission();
                          }
                        }}
                        placeholder="other.permission"
                        aria-label="Add a custom permission"
                        className="font-mono"
                        spellCheck={false}
                      />
                      <Button type="button" variant="secondary" onClick={addCustomPermission}>
                        Add
                      </Button>
                    </div>

                    {customPermissions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5" aria-label="Custom permissions">
                        {customPermissions.map((permission) => (
                          <Badge key={permission} variant="secondary" className="font-mono">
                            {permission}
                            <button
                              type="button"
                              aria-label={`Remove ${permission} permission`}
                              onClick={() => togglePermission(permission)}
                              className="ml-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <X className="size-3" aria-hidden="true" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </fieldset>

                  <Alert variant="info">
                    <ShieldCheck className="size-4" />
                    <AlertTitle>External-only plugin policy</AlertTitle>
                    <AlertDescription>
                      Third-party plugins run as isolated workloads, never inside the core.{' '}
                      <a
                        href={EXTERNAL_PLUGINS_DOC_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium underline underline-offset-2"
                      >
                        Learn how external plugins are deployed
                      </a>
                      . JAR uploads are no longer accepted.
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </CardContent>

            <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/plugins/marketplace')}
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              <div className="flex gap-2">
                {step > 0 && (
                  <Button type="button" variant="secondary" onClick={goBack} disabled={isSubmitting}>
                    Back
                  </Button>
                )}
                {step < STEPS.length - 1 ? (
                  <Button type="button" onClick={goNext}>
                    Next
                  </Button>
                ) : (
                  <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting Plugin…' : 'Submit Plugin'}
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  );
}
