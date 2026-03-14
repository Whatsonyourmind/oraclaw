/**
 * DelegationFlow Component
 *
 * A multi-step flow for delegating tasks to team members with
 * context notes, deadline setting, and load indicators.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

// Types
interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  currentLoad: number;
  maxCapacity: number;
  availability: 'available' | 'busy' | 'away' | 'offline';
  skills: string[];
  recentTasks: number;
}

interface DelegationRequest {
  taskId: string;
  taskTitle: string;
  delegateTo: string;
  deadline?: Date;
  priority: 'critical' | 'high' | 'medium' | 'low';
  contextNote: string;
  requiredSkills: string[];
  estimatedHours: number;
}

interface DelegationFlowProps {
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  requiredSkills?: string[];
  suggestedDeadline?: Date;
  teamMembers: TeamMember[];
  onDelegate: (request: DelegationRequest) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

type FlowStep = 'member' | 'context' | 'deadline' | 'confirm';

// Mock data for demo
const mockTeamMembers: TeamMember[] = [
  {
    id: '1',
    name: 'Alice Johnson',
    email: 'alice@company.com',
    avatar: undefined,
    role: 'Senior Analyst',
    currentLoad: 65,
    maxCapacity: 100,
    availability: 'available',
    skills: ['analysis', 'strategy', 'research'],
    recentTasks: 3,
  },
  {
    id: '2',
    name: 'Bob Smith',
    email: 'bob@company.com',
    avatar: undefined,
    role: 'Developer',
    currentLoad: 85,
    maxCapacity: 100,
    availability: 'busy',
    skills: ['development', 'architecture', 'testing'],
    recentTasks: 5,
  },
  {
    id: '3',
    name: 'Carol Davis',
    email: 'carol@company.com',
    avatar: undefined,
    role: 'Designer',
    currentLoad: 45,
    maxCapacity: 100,
    availability: 'available',
    skills: ['design', 'ux', 'research'],
    recentTasks: 2,
  },
];

export const DelegationFlow: React.FC<DelegationFlowProps> = ({
  taskId,
  taskTitle,
  taskDescription,
  requiredSkills = [],
  suggestedDeadline,
  teamMembers = mockTeamMembers,
  onDelegate,
  onCancel,
  loading = false,
}) => {
  const [currentStep, setCurrentStep] = useState<FlowStep>('member');
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [contextNote, setContextNote] = useState('');
  const [deadline, setDeadline] = useState<Date | undefined>(suggestedDeadline);
  const [priority, setPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [estimatedHours, setEstimatedHours] = useState(4);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter team members based on search
  const filteredMembers = useMemo(() => {
    if (!searchQuery) return teamMembers;
    const query = searchQuery.toLowerCase();
    return teamMembers.filter(
      member =>
        member.name.toLowerCase().includes(query) ||
        member.role.toLowerCase().includes(query) ||
        member.skills.some(skill => skill.toLowerCase().includes(query))
    );
  }, [teamMembers, searchQuery]);

  // Sort by availability and load
  const sortedMembers = useMemo(() => {
    return [...filteredMembers].sort((a, b) => {
      // Available first
      if (a.availability === 'available' && b.availability !== 'available') return -1;
      if (b.availability === 'available' && a.availability !== 'available') return 1;
      // Then by load (lower is better)
      return a.currentLoad - b.currentLoad;
    });
  }, [filteredMembers]);

  const handleNext = useCallback(() => {
    const steps: FlowStep[] = ['member', 'context', 'deadline', 'confirm'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    const steps: FlowStep[] = ['member', 'context', 'deadline', 'confirm'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    } else {
      onCancel();
    }
  }, [currentStep, onCancel]);

  const handleSubmit = useCallback(async () => {
    if (!selectedMember) return;

    setIsSubmitting(true);
    try {
      await onDelegate({
        taskId,
        taskTitle,
        delegateTo: selectedMember.id,
        deadline,
        priority,
        contextNote,
        requiredSkills,
        estimatedHours,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedMember, taskId, taskTitle, deadline, priority, contextNote, requiredSkills, estimatedHours, onDelegate]);

  const getLoadColor = (load: number): string => {
    if (load < 50) return '#10B981';
    if (load < 75) return '#F59E0B';
    return '#EF4444';
  };

  const getAvailabilityColor = (availability: TeamMember['availability']): string => {
    switch (availability) {
      case 'available': return '#10B981';
      case 'busy': return '#F59E0B';
      case 'away': return '#6B7280';
      case 'offline': return '#9CA3AF';
      default: return '#6B7280';
    }
  };

  const renderMemberCard = ({ item: member }: { item: TeamMember }) => {
    const isSelected = selectedMember?.id === member.id;
    const skillMatch = requiredSkills.filter(skill =>
      member.skills.includes(skill)
    ).length;
    const skillMatchPercent = requiredSkills.length > 0
      ? (skillMatch / requiredSkills.length) * 100
      : 100;

    return (
      <TouchableOpacity
        style={[
          styles.memberCard,
          isSelected && styles.memberCardSelected,
          member.availability === 'offline' && styles.memberCardDisabled,
        ]}
        onPress={() => {
          if (member.availability !== 'offline') {
            setSelectedMember(member);
          }
        }}
        disabled={member.availability === 'offline'}
      >
        <View style={styles.memberHeader}>
          <View style={styles.memberAvatar}>
            {member.avatar ? (
              <Image source={{ uri: member.avatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {member.name.split(' ').map(n => n[0]).join('')}
              </Text>
            )}
            <View
              style={[
                styles.availabilityDot,
                { backgroundColor: getAvailabilityColor(member.availability) },
              ]}
            />
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{member.name}</Text>
            <Text style={styles.memberRole}>{member.role}</Text>
          </View>
          {isSelected && (
            <View style={styles.checkMark}>
              <Text style={styles.checkMarkText}>✓</Text>
            </View>
          )}
        </View>

        <View style={styles.loadContainer}>
          <View style={styles.loadHeader}>
            <Text style={styles.loadLabel}>Current Load</Text>
            <Text style={[styles.loadPercent, { color: getLoadColor(member.currentLoad) }]}>
              {member.currentLoad}%
            </Text>
          </View>
          <View style={styles.loadBarBackground}>
            <View
              style={[
                styles.loadBarFill,
                {
                  width: `${member.currentLoad}%`,
                  backgroundColor: getLoadColor(member.currentLoad),
                },
              ]}
            />
          </View>
        </View>

        {requiredSkills.length > 0 && (
          <View style={styles.skillMatch}>
            <Text style={styles.skillMatchLabel}>
              Skill Match: {skillMatchPercent.toFixed(0)}%
            </Text>
            <View style={styles.skillTags}>
              {member.skills.slice(0, 3).map(skill => (
                <View
                  key={skill}
                  style={[
                    styles.skillTag,
                    requiredSkills.includes(skill) && styles.skillTagMatched,
                  ]}
                >
                  <Text
                    style={[
                      styles.skillTagText,
                      requiredSkills.includes(skill) && styles.skillTagTextMatched,
                    ]}
                  >
                    {skill}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderMemberStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Select Team Member</Text>
      <Text style={styles.stepDescription}>
        Choose who should handle this task
      </Text>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, role, or skill..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={sortedMembers}
        renderItem={renderMemberCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.memberList}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );

  const renderContextStep = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.stepContainer}
    >
      <Text style={styles.stepTitle}>Add Context</Text>
      <Text style={styles.stepDescription}>
        Provide any helpful information for {selectedMember?.name}
      </Text>

      <View style={styles.contextSection}>
        <Text style={styles.inputLabel}>Task: {taskTitle}</Text>
        {taskDescription && (
          <Text style={styles.taskDescription}>{taskDescription}</Text>
        )}
      </View>

      <View style={styles.contextSection}>
        <Text style={styles.inputLabel}>Context Note</Text>
        <TextInput
          style={styles.contextInput}
          placeholder="Add background information, specific requirements, or helpful tips..."
          placeholderTextColor="#9CA3AF"
          value={contextNote}
          onChangeText={setContextNote}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.contextSection}>
        <Text style={styles.inputLabel}>Estimated Effort</Text>
        <View style={styles.hoursContainer}>
          {[2, 4, 8, 16, 24].map(hours => (
            <TouchableOpacity
              key={hours}
              style={[
                styles.hoursButton,
                estimatedHours === hours && styles.hoursButtonSelected,
              ]}
              onPress={() => setEstimatedHours(hours)}
            >
              <Text
                style={[
                  styles.hoursButtonText,
                  estimatedHours === hours && styles.hoursButtonTextSelected,
                ]}
              >
                {hours}h
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  const renderDeadlineStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Set Deadline & Priority</Text>
      <Text style={styles.stepDescription}>
        When does this need to be completed?
      </Text>

      <View style={styles.contextSection}>
        <Text style={styles.inputLabel}>Priority Level</Text>
        <View style={styles.priorityContainer}>
          {(['critical', 'high', 'medium', 'low'] as const).map(p => (
            <TouchableOpacity
              key={p}
              style={[
                styles.priorityButton,
                priority === p && styles.priorityButtonSelected,
                priority === p && {
                  backgroundColor: p === 'critical' ? '#EF4444' :
                    p === 'high' ? '#F59E0B' :
                    p === 'medium' ? '#3B82F6' : '#6B7280',
                },
              ]}
              onPress={() => setPriority(p)}
            >
              <Text
                style={[
                  styles.priorityButtonText,
                  priority === p && styles.priorityButtonTextSelected,
                ]}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.contextSection}>
        <Text style={styles.inputLabel}>Deadline</Text>
        <View style={styles.deadlineOptions}>
          {[
            { label: 'Today', days: 0 },
            { label: 'Tomorrow', days: 1 },
            { label: 'This Week', days: 7 },
            { label: 'Next Week', days: 14 },
            { label: 'Custom', days: -1 },
          ].map(option => {
            const optionDate = option.days >= 0
              ? new Date(Date.now() + option.days * 24 * 60 * 60 * 1000)
              : undefined;
            const isSelected = deadline?.toDateString() === optionDate?.toDateString();

            return (
              <TouchableOpacity
                key={option.label}
                style={[
                  styles.deadlineButton,
                  isSelected && styles.deadlineButtonSelected,
                ]}
                onPress={() => setDeadline(optionDate)}
              >
                <Text
                  style={[
                    styles.deadlineButtonText,
                    isSelected && styles.deadlineButtonTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {deadline && (
        <View style={styles.selectedDeadline}>
          <Text style={styles.selectedDeadlineLabel}>Selected:</Text>
          <Text style={styles.selectedDeadlineValue}>
            {deadline.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>
      )}
    </View>
  );

  const renderConfirmStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Confirm Delegation</Text>
      <Text style={styles.stepDescription}>
        Review the details before delegating
      </Text>

      <View style={styles.confirmCard}>
        <View style={styles.confirmSection}>
          <Text style={styles.confirmLabel}>Task</Text>
          <Text style={styles.confirmValue}>{taskTitle}</Text>
        </View>

        <View style={styles.confirmDivider} />

        <View style={styles.confirmSection}>
          <Text style={styles.confirmLabel}>Delegate To</Text>
          <View style={styles.confirmMember}>
            <View style={styles.memberAvatarSmall}>
              <Text style={styles.avatarTextSmall}>
                {selectedMember?.name.split(' ').map(n => n[0]).join('')}
              </Text>
            </View>
            <View>
              <Text style={styles.confirmValue}>{selectedMember?.name}</Text>
              <Text style={styles.confirmSubvalue}>{selectedMember?.role}</Text>
            </View>
          </View>
        </View>

        <View style={styles.confirmDivider} />

        <View style={styles.confirmSection}>
          <Text style={styles.confirmLabel}>Priority</Text>
          <View
            style={[
              styles.priorityBadge,
              {
                backgroundColor: priority === 'critical' ? '#FEE2E2' :
                  priority === 'high' ? '#FEF3C7' :
                  priority === 'medium' ? '#DBEAFE' : '#F3F4F6',
              },
            ]}
          >
            <Text
              style={[
                styles.priorityBadgeText,
                {
                  color: priority === 'critical' ? '#DC2626' :
                    priority === 'high' ? '#D97706' :
                    priority === 'medium' ? '#2563EB' : '#4B5563',
                },
              ]}
            >
              {priority.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.confirmDivider} />

        <View style={styles.confirmSection}>
          <Text style={styles.confirmLabel}>Deadline</Text>
          <Text style={styles.confirmValue}>
            {deadline
              ? deadline.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'No deadline set'}
          </Text>
        </View>

        <View style={styles.confirmDivider} />

        <View style={styles.confirmSection}>
          <Text style={styles.confirmLabel}>Estimated Effort</Text>
          <Text style={styles.confirmValue}>{estimatedHours} hours</Text>
        </View>

        {contextNote && (
          <>
            <View style={styles.confirmDivider} />
            <View style={styles.confirmSection}>
              <Text style={styles.confirmLabel}>Context Note</Text>
              <Text style={styles.confirmNote}>{contextNote}</Text>
            </View>
          </>
        )}
      </View>

      {selectedMember && selectedMember.currentLoad > 80 && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            {selectedMember.name} is currently at high capacity ({selectedMember.currentLoad}%). Consider the timing carefully.
          </Text>
        </View>
      )}
    </View>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 'member':
        return renderMemberStep();
      case 'context':
        return renderContextStep();
      case 'deadline':
        return renderDeadlineStep();
      case 'confirm':
        return renderConfirmStep();
      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'member':
        return selectedMember !== null;
      case 'context':
        return true;
      case 'deadline':
        return true;
      case 'confirm':
        return true;
      default:
        return false;
    }
  };

  const steps: FlowStep[] = ['member', 'context', 'deadline', 'confirm'];
  const stepLabels = ['Select', 'Context', 'Deadline', 'Confirm'];

  return (
    <View style={styles.container}>
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        {steps.map((step, index) => (
          <React.Fragment key={step}>
            <View
              style={[
                styles.progressStep,
                steps.indexOf(currentStep) >= index && styles.progressStepActive,
              ]}
            >
              <Text
                style={[
                  styles.progressStepText,
                  steps.indexOf(currentStep) >= index && styles.progressStepTextActive,
                ]}
              >
                {index + 1}
              </Text>
            </View>
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.progressLine,
                  steps.indexOf(currentStep) > index && styles.progressLineActive,
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Step Labels */}
      <View style={styles.stepLabels}>
        {stepLabels.map((label, index) => (
          <Text
            key={label}
            style={[
              styles.stepLabel,
              steps.indexOf(currentStep) === index && styles.stepLabelActive,
            ]}
          >
            {label}
          </Text>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderStepContent()}
      </ScrollView>

      {/* Footer Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>
            {currentStep === 'member' ? 'Cancel' : 'Back'}
          </Text>
        </TouchableOpacity>

        {currentStep === 'confirm' ? (
          <TouchableOpacity
            style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canProceed() || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.nextButtonText}>Delegate Task</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled]}
            onPress={handleNext}
            disabled={!canProceed()}
          >
            <Text style={styles.nextButtonText}>Next</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 8,
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressStepActive: {
    backgroundColor: '#3B82F6',
  },
  progressStepText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  progressStepTextActive: {
    color: '#FFFFFF',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  progressLineActive: {
    backgroundColor: '#3B82F6',
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  stepLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    flex: 1,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  memberList: {
    paddingBottom: 20,
  },
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  memberCardSelected: {
    borderColor: '#3B82F6',
  },
  memberCardDisabled: {
    opacity: 0.5,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  availabilityDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  memberRole: {
    fontSize: 14,
    color: '#6B7280',
  },
  checkMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadContainer: {
    marginBottom: 12,
  },
  loadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  loadLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  loadPercent: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadBarBackground: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
  },
  loadBarFill: {
    height: 6,
    borderRadius: 3,
  },
  skillMatch: {
    marginTop: 4,
  },
  skillMatchLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  skillTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  skillTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  skillTagMatched: {
    backgroundColor: '#DBEAFE',
  },
  skillTagText: {
    fontSize: 12,
    color: '#6B7280',
  },
  skillTagTextMatched: {
    color: '#2563EB',
  },
  contextSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  taskDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  contextInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 120,
  },
  hoursContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  hoursButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  hoursButtonSelected: {
    backgroundColor: '#3B82F6',
  },
  hoursButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  hoursButtonTextSelected: {
    color: '#FFFFFF',
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  priorityButtonSelected: {
    backgroundColor: '#3B82F6',
  },
  priorityButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  priorityButtonTextSelected: {
    color: '#FFFFFF',
  },
  deadlineOptions: {
    gap: 8,
  },
  deadlineButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  deadlineButtonSelected: {
    backgroundColor: '#3B82F6',
  },
  deadlineButtonText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  deadlineButtonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  selectedDeadline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  selectedDeadlineLabel: {
    fontSize: 14,
    color: '#2563EB',
    marginRight: 8,
  },
  selectedDeadlineValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  confirmCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  confirmSection: {
    paddingVertical: 12,
  },
  confirmLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  confirmValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  confirmSubvalue: {
    fontSize: 14,
    color: '#6B7280',
  },
  confirmMember: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarTextSmall: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  confirmDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  confirmNote: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  warningBanner: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#92400E',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  backButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  nextButton: {
    flex: 2,
    paddingVertical: 14,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default DelegationFlow;
