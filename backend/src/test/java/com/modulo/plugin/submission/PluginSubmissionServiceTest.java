package com.modulo.plugin.submission;

import com.modulo.plugin.api.PluginException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("Plugin Submission Service Tests")
class PluginSubmissionServiceTest {

    @Mock
    private PluginSubmissionRepository submissionRepository;
    @Mock
    private PluginValidationService validationService;

    @InjectMocks
    private PluginSubmissionService service;

    @Test
    void getSubmissionFound() {
        PluginSubmission sub = new PluginSubmission();
        sub.setSubmissionId("s1");
        when(submissionRepository.findById("s1")).thenReturn(Optional.of(sub));

        assertThat(service.getSubmission("s1")).contains(sub);
    }

    @Test
    void getSubmissionEmpty() {
        when(submissionRepository.findById("missing")).thenReturn(Optional.empty());

        assertThat(service.getSubmission("missing")).isEmpty();
    }

    @Test
    void getSubmissionsByDeveloper() {
        PluginSubmission sub = new PluginSubmission();
        when(submissionRepository.findByDeveloperEmailOrderBySubmittedAtDesc("dev@example.com"))
                .thenReturn(List.of(sub));

        assertThat(service.getSubmissionsByDeveloper("dev@example.com")).containsExactly(sub);
    }

    @Test
    void getAllSubmissions() {
        Pageable pageable = PageRequest.of(0, 10);
        Page<PluginSubmission> page = new PageImpl<>(List.of(new PluginSubmission()));
        when(submissionRepository.findAllByOrderBySubmittedAtDesc(any(Pageable.class))).thenReturn(page);

        assertThat(service.getAllSubmissions(pageable).getContent()).hasSize(1);
    }

    @Test
    void getSubmissionsByStatus() {
        Pageable pageable = PageRequest.of(0, 10);
        Page<PluginSubmission> page = new PageImpl<>(List.of(new PluginSubmission()));
        when(submissionRepository.findByStatusOrderBySubmittedAtDesc(any(SubmissionStatus.class), any(Pageable.class)))
                .thenReturn(page);

        assertThat(service.getSubmissionsByStatus(SubmissionStatus.PENDING_REVIEW, pageable).getContent()).hasSize(1);
    }

    @Test
    void updateStatusOfUnknownSubmissionThrows() {
        when(submissionRepository.findById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateSubmissionStatus("missing", SubmissionStatus.APPROVED, "notes"))
                .isInstanceOf(PluginException.class);
    }
}
